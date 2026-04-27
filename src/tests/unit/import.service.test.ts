/**
 * ImportService 单元测试
 * 测试导入模板生成和批量导入书籍功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeDatabase, closeDatabase, getSqliteDatabase } from '../../main/db';
import { ImportService } from '../../main/services/import.service';
import { ERROR_MESSAGES, IMPORT_TEMPLATE_COLUMNS } from '../../shared/constants';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import os from 'os';

function getTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'import-svc-test-'));
  return path.join(dir, 'test.db');
}

/**
 * 创建一个包含书籍数据的 xlsx Buffer
 */
function createXlsxBuffer(rows: Record<string, string>[]): Buffer {
  const headers = ['书名', '作者', 'ISBN', '分类', '描述'];
  const data = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(buf);
}

/**
 * 创建一个包含书籍数据的 csv Buffer（使用 XLSX 库生成以确保格式一致）
 * 添加 UTF-8 BOM 以确保中文列标题正确识别
 */
function createCsvBuffer(rows: Record<string, string>[]): Buffer {
  const headers = ['书名', '作者', 'ISBN', '分类', '描述'];
  const data = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ''))];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const csvContent = XLSX.utils.sheet_to_csv(worksheet);
  // Add UTF-8 BOM for proper Chinese character handling
  return Buffer.from('\uFEFF' + csvContent, 'utf-8');
}

/**
 * 创建一个缺少列的 xlsx Buffer
 */
function createXlsxBufferWithColumns(columns: string[], rows: string[][]): Buffer {
  const data = [columns, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(buf);
}

/**
 * 创建一个空的 xlsx Buffer（只有标题行，无数据行）
 */
function createEmptyXlsxBuffer(): Buffer {
  const headers = ['书名', '作者', 'ISBN', '分类', '描述'];
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(buf);
}

/** 在数据库中预先插入一本书 */
function insertBook(isbn: string): void {
  const sqlite = getSqliteDatabase();
  const id = `pre-${isbn}`;
  sqlite
    .prepare('INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)')
    .run(id, '已有书籍', '已有作者', isbn, '已有分类');
}

describe('ImportService', () => {
  let service: ImportService;

  beforeEach(() => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    service = new ImportService();
  });

  afterEach(() => {
    closeDatabase();
  });

  // ============================================================
  // getTemplate
  // ============================================================

  describe('getTemplate', () => {
    it('生成 xlsx 格式导入模板包含五列标题', () => {
      const buffer = service.getTemplate('xlsx');
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { header: 1 });

      // 第一行应该是列标题
      const headers = data[0] as unknown as string[];
      for (const col of IMPORT_TEMPLATE_COLUMNS) {
        expect(headers).toContain(col);
      }
    });

    it('生成 csv 格式导入模板包含五列标题', () => {
      const buffer = service.getTemplate('csv');
      expect(buffer).toBeInstanceOf(Buffer);

      const csvContent = buffer.toString('utf-8');
      for (const col of IMPORT_TEMPLATE_COLUMNS) {
        expect(csvContent).toContain(col);
      }
    });

    it('模板只有标题行无数据行', () => {
      const buffer = service.getTemplate('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);
      expect(rows).toHaveLength(0);
    });
  });

  // ============================================================
  // importBooks - 文件格式校验
  // ============================================================

  describe('importBooks - 文件格式校验', () => {
    it('拒绝不支持的文件格式', () => {
      const buffer = Buffer.from('test data');
      expect(() => service.importBooks(buffer, 'test.txt')).toThrow(
        ERROR_MESSAGES.UNSUPPORTED_FILE_FORMAT,
      );
    });

    it('拒绝 .doc 格式文件', () => {
      const buffer = Buffer.from('test data');
      expect(() => service.importBooks(buffer, 'test.doc')).toThrow(
        ERROR_MESSAGES.UNSUPPORTED_FILE_FORMAT,
      );
    });

    it('接受 .xlsx 格式文件', () => {
      const buffer = createXlsxBuffer([
        { 书名: '测试', 作者: '作者', ISBN: '123', 分类: '分类', 描述: '' },
      ]);
      const result = service.importBooks(buffer, 'test.xlsx');
      expect(result.totalCount).toBe(1);
    });

    it('接受 .csv 格式文件', () => {
      const buffer = createCsvBuffer([
        { 书名: '测试', 作者: '作者', ISBN: '456', 分类: '分类', 描述: '' },
      ]);
      const result = service.importBooks(buffer, 'test.csv');
      expect(result.totalCount).toBe(1);
    });
  });

  // ============================================================
  // importBooks - 列标题校验
  // ============================================================

  describe('importBooks - 列标题校验', () => {
    it('缺少必需列标题时拒绝导入并列出缺少的列', () => {
      // 只有书名和作者列，缺少 ISBN、分类、描述
      const buffer = createXlsxBufferWithColumns(
        ['书名', '作者'],
        [['测试书', '测试作者']],
      );

      expect(() => service.importBooks(buffer, 'test.xlsx')).toThrow(
        ERROR_MESSAGES.MISSING_REQUIRED_COLUMNS,
      );

      try {
        service.importBooks(buffer, 'test.xlsx');
      } catch (e) {
        const msg = (e as Error).message;
        expect(msg).toContain('ISBN');
        expect(msg).toContain('分类');
        expect(msg).toContain('描述');
      }
    });

    it('所有必需列标题存在时正常处理', () => {
      const buffer = createXlsxBuffer([
        { 书名: '测试', 作者: '作者', ISBN: '789', 分类: '分类', 描述: '描述' },
      ]);
      const result = service.importBooks(buffer, 'test.xlsx');
      expect(result.successCount).toBe(1);
    });
  });

  // ============================================================
  // importBooks - 空文件处理
  // ============================================================

  describe('importBooks - 空文件处理', () => {
    it('空文件（无数据行）提示无数据记录', () => {
      const buffer = createEmptyXlsxBuffer();
      expect(() => service.importBooks(buffer, 'test.xlsx')).toThrow(
        ERROR_MESSAGES.EMPTY_IMPORT_FILE,
      );
    });
  });

  // ============================================================
  // importBooks - 记录校验
  // ============================================================

  describe('importBooks - 记录校验', () => {
    it('必填字段为空时记录失败', () => {
      const buffer = createXlsxBuffer([
        { 书名: '', 作者: '作者', ISBN: '111', 分类: '分类', 描述: '' },
      ]);
      const result = service.importBooks(buffer, 'test.xlsx');
      expect(result.failureCount).toBe(1);
      expect(result.failures[0].reason).toContain('书名');
    });

    it('ISBN 为空时记录失败', () => {
      const buffer = createXlsxBuffer([
        { 书名: '测试', 作者: '作者', ISBN: '', 分类: '分类', 描述: '' },
      ]);
      const result = service.importBooks(buffer, 'test.xlsx');
      expect(result.failureCount).toBe(1);
      expect(result.failures[0].reason).toContain('ISBN');
    });

    it('作者为空时记录失败', () => {
      const buffer = createXlsxBuffer([
        { 书名: '测试', 作者: '', ISBN: '222', 分类: '分类', 描述: '' },
      ]);
      const result = service.importBooks(buffer, 'test.xlsx');
      expect(result.failureCount).toBe(1);
      expect(result.failures[0].reason).toContain('作者');
    });

    it('分类为空时记录失败', () => {
      const buffer = createXlsxBuffer([
        { 书名: '测试', 作者: '作者', ISBN: '333', 分类: '', 描述: '' },
      ]);
      const result = service.importBooks(buffer, 'test.xlsx');
      expect(result.failureCount).toBe(1);
      expect(result.failures[0].reason).toContain('分类');
    });

    it('描述为空时仍可成功导入', () => {
      const buffer = createXlsxBuffer([
        { 书名: '测试', 作者: '作者', ISBN: '444', 分类: '分类', 描述: '' },
      ]);
      const result = service.importBooks(buffer, 'test.xlsx');
      expect(result.successCount).toBe(1);
    });
  });

  // ============================================================
  // importBooks - ISBN 唯一性校验
  // ============================================================

  describe('importBooks - ISBN 唯一性校验', () => {
    it('数据库中已存在的 ISBN 导入失败', () => {
      insertBook('EXISTING-ISBN');

      const buffer = createXlsxBuffer([
        { 书名: '新书', 作者: '作者', ISBN: 'EXISTING-ISBN', 分类: '分类', 描述: '' },
      ]);
      const result = service.importBooks(buffer, 'test.xlsx');
      expect(result.failureCount).toBe(1);
      expect(result.failures[0].reason).toBe(ERROR_MESSAGES.ISBN_ALREADY_EXISTS);
    });

    it('本次导入中重复的 ISBN 第二条失败', () => {
      const buffer = createXlsxBuffer([
        { 书名: '书A', 作者: '作者A', ISBN: 'DUP-ISBN', 分类: '分类A', 描述: '' },
        { 书名: '书B', 作者: '作者B', ISBN: 'DUP-ISBN', 分类: '分类B', 描述: '' },
      ]);
      const result = service.importBooks(buffer, 'test.xlsx');
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.failures[0].rowNumber).toBe(3); // 第3行（标题行是第1行，第一条数据是第2行）
      expect(result.failures[0].reason).toBe(ERROR_MESSAGES.ISBN_ALREADY_EXISTS);
    });

    it('不同 ISBN 的记录都能成功导入', () => {
      const buffer = createXlsxBuffer([
        { 书名: '书A', 作者: '作者A', ISBN: 'ISBN-A', 分类: '分类', 描述: '' },
        { 书名: '书B', 作者: '作者B', ISBN: 'ISBN-B', 分类: '分类', 描述: '' },
        { 书名: '书C', 作者: '作者C', ISBN: 'ISBN-C', 分类: '分类', 描述: '' },
      ]);
      const result = service.importBooks(buffer, 'test.xlsx');
      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
    });
  });

  // ============================================================
  // importBooks - 失败跳过继续处理
  // ============================================================

  describe('importBooks - 失败跳过继续处理', () => {
    it('部分记录失败时继续处理其余记录', () => {
      insertBook('EXISTING-ISBN');

      const buffer = createXlsxBuffer([
        { 书名: '书A', 作者: '作者A', ISBN: 'NEW-ISBN-1', 分类: '分类', 描述: '' },
        { 书名: '书B', 作者: '作者B', ISBN: 'EXISTING-ISBN', 分类: '分类', 描述: '' },
        { 书名: '书C', 作者: '作者C', ISBN: 'NEW-ISBN-2', 分类: '分类', 描述: '' },
      ]);
      const result = service.importBooks(buffer, 'test.xlsx');
      expect(result.totalCount).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
      expect(result.failures[0].rowNumber).toBe(3); // 第二条数据在第3行
    });

    it('所有记录均失败时返回完整失败摘要', () => {
      const buffer = createXlsxBuffer([
        { 书名: '', 作者: '作者A', ISBN: 'ISBN-1', 分类: '分类', 描述: '' },
        { 书名: '书B', 作者: '', ISBN: 'ISBN-2', 分类: '分类', 描述: '' },
        { 书名: '书C', 作者: '作者C', ISBN: '', 分类: '分类', 描述: '' },
      ]);
      const result = service.importBooks(buffer, 'test.xlsx');
      expect(result.totalCount).toBe(3);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(3);
      expect(result.failures).toHaveLength(3);
    });
  });

  // ============================================================
  // importBooks - 结果摘要
  // ============================================================

  describe('importBooks - 结果摘要', () => {
    it('返回正确的行号', () => {
      const buffer = createXlsxBuffer([
        { 书名: '书A', 作者: '作者A', ISBN: 'ISBN-1', 分类: '分类', 描述: '' },
        { 书名: '', 作者: '作者B', ISBN: 'ISBN-2', 分类: '分类', 描述: '' },
        { 书名: '书C', 作者: '作者C', ISBN: 'ISBN-3', 分类: '分类', 描述: '' },
        { 书名: '书D', 作者: '', ISBN: 'ISBN-4', 分类: '分类', 描述: '' },
      ]);
      const result = service.importBooks(buffer, 'test.xlsx');
      expect(result.totalCount).toBe(4);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(2);
      // 行号：标题行是第1行，数据从第2行开始
      expect(result.failures[0].rowNumber).toBe(3); // 第二条数据
      expect(result.failures[1].rowNumber).toBe(5); // 第四条数据
    });

    it('成功导入的记录确实写入数据库', () => {
      const buffer = createXlsxBuffer([
        { 书名: '红楼梦', 作者: '曹雪芹', ISBN: 'ISBN-HLM', 分类: '文学', 描述: '四大名著之一' },
      ]);
      const result = service.importBooks(buffer, 'test.xlsx');
      expect(result.successCount).toBe(1);

      // 验证数据库中确实有这条记录
      const sqlite = getSqliteDatabase();
      const row = sqlite.prepare('SELECT * FROM books WHERE isbn = ?').get('ISBN-HLM') as Record<string, unknown>;
      expect(row).toBeDefined();
      expect(row.title).toBe('红楼梦');
      expect(row.author).toBe('曹雪芹');
      expect(row.category).toBe('文学');
      expect(row.description).toBe('四大名著之一');
    });

    it('成功导入的记录会记录操作日志', () => {
      const buffer = createXlsxBuffer([
        { 书名: '测试书', 作者: '测试作者', ISBN: 'ISBN-LOG', 分类: '测试', 描述: '' },
      ]);
      service.importBooks(buffer, 'test.xlsx');

      const sqlite = getSqliteDatabase();
      const logs = sqlite
        .prepare("SELECT * FROM operation_logs WHERE entity_type = 'book' AND operation_type = 'create'")
        .all() as Record<string, unknown>[];
      expect(logs.length).toBeGreaterThanOrEqual(1);
    });
  });
});
