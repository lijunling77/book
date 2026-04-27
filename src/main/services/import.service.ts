/**
 * ImportService - 数据导入服务
 * 使用 xlsx (SheetJS) 库实现导入功能
 * 支持从 Excel (.xlsx) 和 CSV (.csv) 文件批量导入书籍基本信息
 * 提供导入模板生成功能
 */

import * as XLSX from 'xlsx';
import path from 'path';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db';
import { books, operationLogs } from '../db/schema';
import {
  ERROR_MESSAGES,
  IMPORT_TEMPLATE_COLUMNS,
  IMPORT_REQUIRED_COLUMNS,
  SUPPORTED_IMPORT_EXTENSIONS,
  OPERATION_TYPES,
  ENTITY_TYPES,
} from '../../shared/constants';
import type {
  ImportResultSummary,
  ImportFailureItem,
  ExportFormat,
  ImportFileFormat,
} from '../../shared/types';

export class ImportService {
  /**
   * 生成导入模板
   * 包含书名、作者、ISBN、分类、描述五列
   *
   * @param format 模板格式 ('xlsx' | 'csv')
   * @returns 模板文件 Buffer
   */
  getTemplate(format: ImportFileFormat): Buffer {
    // 创建包含列标题的空工作表
    const headers = [...IMPORT_TEMPLATE_COLUMNS];
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);

    // 设置列宽
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

  /**
   * 批量导入书籍
   * 1. 校验文件格式 (.xlsx/.csv)
   * 2. 校验必需列标题
   * 3. 逐条校验记录（含 ISBN 唯一性，包括本次已导入的记录）
   * 4. 失败跳过继续处理
   * 5. 返回导入结果摘要
   *
   * @param fileBuffer 文件内容 Buffer
   * @param fileName 文件名（用于格式校验）
   * @returns 导入结果摘要
   */
  importBooks(fileBuffer: Buffer, fileName: string): ImportResultSummary {
    // 校验文件格式
    const ext = path.extname(fileName).toLowerCase();
    if (!SUPPORTED_IMPORT_EXTENSIONS.includes(ext as typeof SUPPORTED_IMPORT_EXTENSIONS[number])) {
      throw new Error(ERROR_MESSAGES.UNSUPPORTED_FILE_FORMAT);
    }

    // 解析文件
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error(ERROR_MESSAGES.EMPTY_IMPORT_FILE);
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { defval: '' });

    // 校验是否有数据
    if (rows.length === 0) {
      throw new Error(ERROR_MESSAGES.EMPTY_IMPORT_FILE);
    }

    // 校验必需列标题
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

    // 逐条处理记录
    const db = getDatabase();
    const result: ImportResultSummary = {
      totalCount: rows.length,
      successCount: 0,
      failureCount: 0,
      failures: [],
    };

    // 记录本次导入中已成功导入的 ISBN，用于唯一性校验
    const importedIsbns = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // Excel 行号（第1行是标题）

      try {
        const title = (row['书名'] ?? '').toString().trim();
        const author = (row['作者'] ?? '').toString().trim();
        const isbn = (row['ISBN'] ?? '').toString().trim();
        const category = (row['分类'] ?? '').toString().trim();
        const description = (row['描述'] ?? '').toString().trim() || null;

        // 校验必填字段
        if (!title) {
          throw new Error('书名不能为空');
        }
        if (!author) {
          throw new Error('作者不能为空');
        }
        if (!isbn) {
          throw new Error('ISBN不能为空');
        }
        if (!category) {
          throw new Error('分类不能为空');
        }

        // 校验 ISBN 唯一性 - 数据库中已有的
        const existingBook = db
          .select()
          .from(books)
          .where(eq(books.isbn, isbn))
          .get();
        if (existingBook) {
          throw new Error(ERROR_MESSAGES.ISBN_ALREADY_EXISTS);
        }

        // 校验 ISBN 唯一性 - 本次导入中已有的
        if (importedIsbns.has(isbn)) {
          throw new Error(ERROR_MESSAGES.ISBN_ALREADY_EXISTS);
        }

        // 创建书籍记录
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const id = uuidv4();

        db.insert(books)
          .values({
            id,
            title,
            author,
            isbn,
            category,
            description,
            createdAt: now,
            updatedAt: now,
          })
          .run();

        // 记录操作日志
        const created = db.select().from(books).where(eq(books.id, id)).get()!;
        db.insert(operationLogs)
          .values({
            id: uuidv4(),
            operationType: OPERATION_TYPES.CREATE,
            entityType: ENTITY_TYPES.BOOK,
            entityId: id,
            beforeData: null,
            afterData: JSON.stringify(created),
          })
          .run();

        importedIsbns.add(isbn);
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
