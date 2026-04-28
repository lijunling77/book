/**
 * ImportService - 数据导入服务
 * 支持从 Excel (.xlsx) 和 CSV (.csv) 文件批量导入书籍基本信息
 */

import * as XLSX from 'xlsx';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db';
import { books } from '../db/schema';
import {
  ERROR_MESSAGES,
  IMPORT_TEMPLATE_COLUMNS,
  IMPORT_REQUIRED_COLUMNS,
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
}
