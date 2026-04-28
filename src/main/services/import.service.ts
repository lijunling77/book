/**
 * ImportService - 数据导入服务
 * 支持从 Excel (.xlsx) 和 CSV (.csv) 文件批量导入书籍基本信息
 */

import * as XLSX from 'xlsx';
import path from 'path';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db';
import { books, locationDict, inboundRecords } from '../db/schema';
import { StockService } from './stock.service';
import {
  ERROR_MESSAGES,
  IMPORT_TEMPLATE_COLUMNS,
  IMPORT_REQUIRED_COLUMNS,
  INBOUND_IMPORT_TEMPLATE_COLUMNS,
  INBOUND_IMPORT_REQUIRED_COLUMNS,
  SUPPORTED_IMPORT_EXTENSIONS,
} from '../../shared/constants';
import type {
  ImportResultSummary,
  ImportFileFormat,
} from '../../shared/types';

export class ImportService {
  getTemplate(format: ImportFileFormat): Buffer {
    const headers = [...IMPORT_TEMPLATE_COLUMNS];
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    worksheet['!cols'] = headers.map(() => ({ wch: 20 }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '导入模板');

    if (format === 'csv') {
      const csvContent = XLSX.utils.sheet_to_csv(worksheet);
      return Buffer.from(csvContent, 'utf-8');
    }

    const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.from(xlsxBuffer);
  }

  importBooks(fileBuffer: Buffer, fileName: string): ImportResultSummary {
    const ext = path.extname(fileName).toLowerCase();
    if (!SUPPORTED_IMPORT_EXTENSIONS.includes(ext as typeof SUPPORTED_IMPORT_EXTENSIONS[number])) {
      throw new Error(ERROR_MESSAGES.UNSUPPORTED_FILE_FORMAT);
    }

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error(ERROR_MESSAGES.EMPTY_IMPORT_FILE);
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { defval: '' });

    if (rows.length === 0) {
      throw new Error(ERROR_MESSAGES.EMPTY_IMPORT_FILE);
    }

    const firstRow = rows[0];
    const existingColumns = Object.keys(firstRow);
    const missingColumns = IMPORT_REQUIRED_COLUMNS.filter(
      (col) => !existingColumns.includes(col),
    );

    if (missingColumns.length > 0) {
      throw new Error(
        `${ERROR_MESSAGES.MISSING_REQUIRED_COLUMNS}：${missingColumns.join('、')}`,
      );
    }

    const db = getDatabase();
    const result: ImportResultSummary = {
      totalCount: rows.length,
      successCount: 0,
      failureCount: 0,
      failures: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      try {
        const title = (row['书名'] ?? '').toString().trim();
        const author = (row['作者'] ?? '').toString().trim();
        const description = (row['描述'] ?? '').toString().trim() || null;

        if (!title) {
          throw new Error('书名不能为空');
        }

        // 校验书名唯一性
        const existingBook = db.select().from(books).where(eq(books.title, title)).get();
        if (existingBook) {
          throw new Error('该书名已存在');
        }

        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const id = uuidv4();

        db.insert(books)
          .values({
            id,
            title,
            author: author || null,
            description,
            createdAt: now,
            updatedAt: now,
          })
          .run();

        result.successCount++;
      } catch (error) {
        result.failureCount++;
        result.failures.push({
          rowNumber,
          reason: error instanceof Error ? error.message : '未知错误',
        });
      }
    }

    return result;
  }

  /**
   * 生成入库导入模板
   */
  getInboundTemplate(format: ImportFileFormat): Buffer {
    const headers = [...INBOUND_IMPORT_TEMPLATE_COLUMNS];
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    worksheet['!cols'] = headers.map(() => ({ wch: 20 }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '入库导入模板');

    if (format === 'csv') {
      const csvContent = XLSX.utils.sheet_to_csv(worksheet);
      return Buffer.from(csvContent, 'utf-8');
    }

    const xlsxBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.from(xlsxBuffer);
  }

  /**
   * 批量导入入库数据
   * 逻辑：按行处理，查找书籍（精确匹配书名），不存在则自动创建，创建入库记录并调整库存
   */
  importInbound(fileBuffer: Buffer, fileName: string): ImportResultSummary {
    const ext = path.extname(fileName).toLowerCase();
    if (!SUPPORTED_IMPORT_EXTENSIONS.includes(ext as typeof SUPPORTED_IMPORT_EXTENSIONS[number])) {
      throw new Error(ERROR_MESSAGES.UNSUPPORTED_FILE_FORMAT);
    }

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error(ERROR_MESSAGES.EMPTY_IMPORT_FILE);
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { defval: '' });

    if (rows.length === 0) {
      throw new Error(ERROR_MESSAGES.EMPTY_IMPORT_FILE);
    }

    // 校验必需列
    const firstRow = rows[0];
    const existingColumns = Object.keys(firstRow);
    const missingColumns = INBOUND_IMPORT_REQUIRED_COLUMNS.filter(
      (col) => !existingColumns.includes(col),
    );

    if (missingColumns.length > 0) {
      throw new Error(
        `${ERROR_MESSAGES.MISSING_REQUIRED_COLUMNS}：${missingColumns.join('、')}`,
      );
    }

    const db = getDatabase();
    const stockService = new StockService();
    const result: ImportResultSummary = {
      totalCount: rows.length,
      successCount: 0,
      failureCount: 0,
      failures: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      try {
        const title = (row['书名'] ?? '').toString().trim();
        const author = (row['作者'] ?? '').toString().trim() || null;
        const location = (row['存放位置'] ?? '').toString().trim() || null;
        const inboundDateRaw = row['入库日期'] ?? '';
        let inboundDate: string;
        if (typeof inboundDateRaw === 'number') {
          // Excel 日期数字转字符串
          const excelDate = new Date((inboundDateRaw - 25569) * 86400 * 1000);
          inboundDate = excelDate.toISOString().slice(0, 10);
        } else {
          inboundDate = inboundDateRaw.toString().trim();
        }
        const quantityStr = (row['数量'] ?? '').toString().trim();
        const purchasePriceStr = (row['买入价格'] ?? '').toString().trim();
        const supplier = (row['供应商'] ?? '').toString().trim() || null;

        if (!title) {
          throw new Error('书名不能为空');
        }
        if (!inboundDate) {
          throw new Error('入库日期不能为空');
        }
        const quantity = Number(quantityStr);
        if (!quantityStr || isNaN(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
          throw new Error('数量必须为正整数');
        }
        const purchasePrice = Number(purchasePriceStr);
        if (!purchasePriceStr || isNaN(purchasePrice) || purchasePrice < 0) {
          throw new Error('买入价格必须为非负数');
        }

        // 1. 查找书籍（精确匹配书名）
        let book = db.select().from(books).where(eq(books.title, title)).get();

        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

        if (!book) {
          // 2. 书籍不存在，自动创建
          const bookId = uuidv4();
          db.insert(books).values({
            id: bookId,
            title,
            author,
            createdAt: now,
            updatedAt: now,
          }).run();
          book = db.select().from(books).where(eq(books.id, bookId)).get()!;
        }

        // 4. 同步位置字典
        if (location) {
          const existingLocation = db.select().from(locationDict).where(eq(locationDict.name, location)).get();
          if (!existingLocation) {
            db.insert(locationDict).values({
              id: uuidv4(),
              name: location,
            }).run();
          }
        }

        // 5. 创建入库记录
        const inboundId = uuidv4();
        db.insert(inboundRecords).values({
          id: inboundId,
          bookId: book.id,
          inboundDate,
          quantity,
          purchasePrice,
          supplier,
          location,
          createdAt: now,
          updatedAt: now,
        }).run();

        // 6. 调整库存
        stockService.adjustStock(book.id, quantity);

        result.successCount++;
      } catch (error) {
        result.failureCount++;
        result.failures.push({
          rowNumber,
          reason: error instanceof Error ? error.message : '未知错误',
        });
      }
    }

    return result;
  }
}
