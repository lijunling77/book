/**
 * ExportService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeDatabase, closeDatabase, getSqliteDatabase } from '../../main/db';
import { ExportService } from '../../main/services/export.service';
import { ERROR_MESSAGES } from '../../shared/constants';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import os from 'os';

function getTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-svc-test-'));
  return path.join(dir, 'test.db');
}

/** 创建测试用的书籍、版本和位置 */
function createTestData(options?: { category?: string; isbn?: string; bookTitle?: string; editionName?: string; warehouse?: string; shelf?: string; layer?: string }) {
  const sqlite = getSqliteDatabase();
  const bookId = uuidv4();
  const editionId = uuidv4();
  const locationId = uuidv4();
  const category = options?.category ?? '测试分类';
  const isbn = options?.isbn ?? `ISBN-${bookId.substring(0, 8)}`;
  const bookTitle = options?.bookTitle ?? '测试书籍';
  const editionName = options?.editionName ?? '精装';
  const warehouse = options?.warehouse ?? '仓库A';
  const shelf = options?.shelf ?? `书架-${locationId.substring(0, 6)}`;
  const layer = options?.layer ?? '层1';

  sqlite
    .prepare('INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)')
    .run(bookId, bookTitle, '测试作者', isbn, category);

  sqlite
    .prepare('INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)')
    .run(editionId, bookId, editionName);

  sqlite
    .prepare('INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)')
    .run(locationId, warehouse, shelf, layer);

  return { bookId, editionId, locationId };
}

/** 创建入库记录 */
function createInboundRecord(
  bookId: string,
  editionId: string,
  locationId: string,
  date: string,
  quantity: number,
  price: number,
  supplier?: string,
): void {
  const sqlite = getSqliteDatabase();
  sqlite
    .prepare(
      'INSERT INTO inbound_records (id, book_id, edition_id, location_id, inbound_date, quantity, purchase_price, supplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(uuidv4(), bookId, editionId, locationId, date, quantity, price, supplier ?? null);
}

/** 创建出库记录 */
function createOutboundRecord(
  bookId: string,
  editionId: string,
  locationId: string,
  date: string,
  quantity: number,
  price: number,
  buyer?: string,
): void {
  const sqlite = getSqliteDatabase();
  sqlite
    .prepare(
      'INSERT INTO outbound_records (id, book_id, edition_id, location_id, outbound_date, quantity, selling_price, buyer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(uuidv4(), bookId, editionId, locationId, date, quantity, price, buyer ?? null);
}

/** 创建库存记录 */
function createStockRecord(
  bookId: string,
  editionId: string,
  locationId: string,
  quantity: number,
): void {
  const sqlite = getSqliteDatabase();
  sqlite
    .prepare(
      'INSERT INTO stock (id, book_id, edition_id, location_id, quantity) VALUES (?, ?, ?, ?, ?)',
    )
    .run(uuidv4(), bookId, editionId, locationId, quantity);
}

/** 从 xlsx Buffer 解析数据 */
function parseXlsxBuffer(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet);
}

/** 从 csv Buffer 解析数据 */
function parseCsvBuffer(buffer: Buffer): Record<string, unknown>[] {
  const csvContent = buffer.toString('utf-8');
  const workbook = XLSX.read(csvContent, { type: 'string' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet);
}

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(() => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    service = new ExportService();
  });

  afterEach(() => {
    closeDatabase();
  });

  // ============================================================
  // exportInbound
  // ============================================================

  describe('exportInbound', () => {
    it('无数据时抛出错误', () => {
      expect(() => service.exportInbound(undefined, 'xlsx')).toThrow(
        ERROR_MESSAGES.NO_DATA_TO_EXPORT,
      );
    });

    it('导出 xlsx 格式入库记录', () => {
      const { bookId, editionId, locationId } = createTestData();
      createInboundRecord(bookId, editionId, locationId, '2024-01-15', 10, 25.5, '供应商A');

      const buffer = service.exportInbound(undefined, 'xlsx');
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      const rows = parseXlsxBuffer(buffer);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveProperty('书名', '测试书籍');
      expect(rows[0]).toHaveProperty('数量', 10);
      expect(rows[0]).toHaveProperty('买入价格', 25.5);
      expect(rows[0]).toHaveProperty('供应商', '供应商A');
    });

    it('导出 csv 格式入库记录', () => {
      const { bookId, editionId, locationId } = createTestData();
      createInboundRecord(bookId, editionId, locationId, '2024-01-15', 5, 30);

      const buffer = service.exportInbound(undefined, 'csv');
      expect(buffer).toBeInstanceOf(Buffer);

      const csvContent = buffer.toString('utf-8');
      expect(csvContent).toContain('书名');
      expect(csvContent).toContain('买入价格');
    });

    it('按书籍筛选入库记录', () => {
      const data1 = createTestData({ bookTitle: '书籍A' });
      const data2 = createTestData({ bookTitle: '书籍B' });

      createInboundRecord(data1.bookId, data1.editionId, data1.locationId, '2024-01-01', 10, 20);
      createInboundRecord(data2.bookId, data2.editionId, data2.locationId, '2024-01-01', 5, 30);

      const buffer = service.exportInbound({ bookId: data1.bookId }, 'xlsx');
      const rows = parseXlsxBuffer(buffer);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveProperty('书名', '书籍A');
    });

    it('按日期范围筛选入库记录', () => {
      const { bookId, editionId, locationId } = createTestData();
      createInboundRecord(bookId, editionId, locationId, '2024-01-01', 10, 20);
      createInboundRecord(bookId, editionId, locationId, '2024-03-01', 5, 30);
      createInboundRecord(bookId, editionId, locationId, '2024-05-01', 3, 40);

      const buffer = service.exportInbound(
        { dateRange: { startDate: '2024-02-01', endDate: '2024-04-01' } },
        'xlsx',
      );
      const rows = parseXlsxBuffer(buffer);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveProperty('数量', 5);
    });

    it('按供应商筛选入库记录', () => {
      const { bookId, editionId, locationId } = createTestData();
      createInboundRecord(bookId, editionId, locationId, '2024-01-01', 10, 20, '供应商A');
      createInboundRecord(bookId, editionId, locationId, '2024-02-01', 5, 30, '供应商B');

      const buffer = service.exportInbound({ supplier: '供应商A' }, 'xlsx');
      const rows = parseXlsxBuffer(buffer);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveProperty('供应商', '供应商A');
    });

    it('筛选条件无匹配数据时抛出错误', () => {
      const { bookId, editionId, locationId } = createTestData();
      createInboundRecord(bookId, editionId, locationId, '2024-01-01', 10, 20);

      expect(() =>
        service.exportInbound({ bookId: 'non-existent-id' }, 'xlsx'),
      ).toThrow(ERROR_MESSAGES.NO_DATA_TO_EXPORT);
    });
  });

  // ============================================================
  // exportOutbound
  // ============================================================

  describe('exportOutbound', () => {
    it('无数据时抛出错误', () => {
      expect(() => service.exportOutbound(undefined, 'xlsx')).toThrow(
        ERROR_MESSAGES.NO_DATA_TO_EXPORT,
      );
    });

    it('导出 xlsx 格式出库记录', () => {
      const { bookId, editionId, locationId } = createTestData();
      createOutboundRecord(bookId, editionId, locationId, '2024-02-15', 3, 50, '买家X');

      const buffer = service.exportOutbound(undefined, 'xlsx');
      const rows = parseXlsxBuffer(buffer);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveProperty('书名', '测试书籍');
      expect(rows[0]).toHaveProperty('数量', 3);
      expect(rows[0]).toHaveProperty('售出价格', 50);
      expect(rows[0]).toHaveProperty('买家', '买家X');
    });

    it('导出 csv 格式出库记录', () => {
      const { bookId, editionId, locationId } = createTestData();
      createOutboundRecord(bookId, editionId, locationId, '2024-02-15', 3, 50);

      const buffer = service.exportOutbound(undefined, 'csv');
      const csvContent = buffer.toString('utf-8');
      expect(csvContent).toContain('书名');
      expect(csvContent).toContain('售出价格');
    });

    it('按买家筛选出库记录', () => {
      const { bookId, editionId, locationId } = createTestData();
      createOutboundRecord(bookId, editionId, locationId, '2024-01-01', 3, 50, '买家A');
      createOutboundRecord(bookId, editionId, locationId, '2024-02-01', 5, 60, '买家B');

      const buffer = service.exportOutbound({ buyer: '买家A' }, 'xlsx');
      const rows = parseXlsxBuffer(buffer);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveProperty('买家', '买家A');
    });

    it('按日期范围筛选出库记录', () => {
      const { bookId, editionId, locationId } = createTestData();
      createOutboundRecord(bookId, editionId, locationId, '2024-01-01', 3, 50);
      createOutboundRecord(bookId, editionId, locationId, '2024-03-01', 5, 60);

      const buffer = service.exportOutbound(
        { dateRange: { startDate: '2024-02-01', endDate: '2024-04-01' } },
        'xlsx',
      );
      const rows = parseXlsxBuffer(buffer);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveProperty('数量', 5);
    });
  });

  // ============================================================
  // exportStock
  // ============================================================

  describe('exportStock', () => {
    it('无数据时抛出错误', () => {
      expect(() => service.exportStock(undefined, 'xlsx')).toThrow(
        ERROR_MESSAGES.NO_DATA_TO_EXPORT,
      );
    });

    it('导出 xlsx 格式库存信息', () => {
      const { bookId, editionId, locationId } = createTestData({ category: '文学' });
      createStockRecord(bookId, editionId, locationId, 15);

      const buffer = service.exportStock(undefined, 'xlsx');
      const rows = parseXlsxBuffer(buffer);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveProperty('书名', '测试书籍');
      expect(rows[0]).toHaveProperty('分类', '文学');
      expect(rows[0]).toHaveProperty('库存数量', 15);
    });

    it('导出 csv 格式库存信息', () => {
      const { bookId, editionId, locationId } = createTestData();
      createStockRecord(bookId, editionId, locationId, 10);

      const buffer = service.exportStock(undefined, 'csv');
      const csvContent = buffer.toString('utf-8');
      expect(csvContent).toContain('书名');
      expect(csvContent).toContain('库存数量');
    });

    it('按书名筛选库存信息', () => {
      const data1 = createTestData({ bookTitle: '红楼梦' });
      const data2 = createTestData({ bookTitle: '西游记' });
      createStockRecord(data1.bookId, data1.editionId, data1.locationId, 10);
      createStockRecord(data2.bookId, data2.editionId, data2.locationId, 5);

      const buffer = service.exportStock({ bookTitle: '红楼梦' }, 'xlsx');
      const rows = parseXlsxBuffer(buffer);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveProperty('书名', '红楼梦');
    });

    it('按分类筛选库存信息', () => {
      const data1 = createTestData({ category: '文学' });
      const data2 = createTestData({ category: '科技' });
      createStockRecord(data1.bookId, data1.editionId, data1.locationId, 10);
      createStockRecord(data2.bookId, data2.editionId, data2.locationId, 5);

      const buffer = service.exportStock({ category: '文学' }, 'xlsx');
      const rows = parseXlsxBuffer(buffer);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveProperty('分类', '文学');
    });

    it('按版本名称筛选库存信息', () => {
      const data1 = createTestData({ editionName: '精装版' });
      const data2 = createTestData({ editionName: '平装版' });
      createStockRecord(data1.bookId, data1.editionId, data1.locationId, 10);
      createStockRecord(data2.bookId, data2.editionId, data2.locationId, 5);

      const buffer = service.exportStock({ editionName: '精装版' }, 'xlsx');
      const rows = parseXlsxBuffer(buffer);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveProperty('版本', '精装版');
    });
  });

  // ============================================================
  // exportProfit
  // ============================================================

  describe('exportProfit', () => {
    it('无数据时抛出错误', () => {
      expect(() => service.exportProfit(undefined, 'xlsx')).toThrow(
        ERROR_MESSAGES.NO_DATA_TO_EXPORT,
      );
    });

    it('导出 xlsx 格式利润统计', () => {
      const { bookId, editionId, locationId } = createTestData({ category: '文学' });
      createInboundRecord(bookId, editionId, locationId, '2024-01-01', 10, 20);
      createOutboundRecord(bookId, editionId, locationId, '2024-02-01', 8, 35);

      const buffer = service.exportProfit(undefined, 'xlsx');
      const rows = parseXlsxBuffer(buffer);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveProperty('分类', '文学');
      expect(rows[0]).toHaveProperty('总采购成本', 200);
      expect(rows[0]).toHaveProperty('总销售收入', 280);
      expect(rows[0]).toHaveProperty('净利润', 80);
    });

    it('导出 csv 格式利润统计', () => {
      const { bookId, editionId, locationId } = createTestData({ category: '科技' });
      createInboundRecord(bookId, editionId, locationId, '2024-01-01', 5, 30);
      createOutboundRecord(bookId, editionId, locationId, '2024-02-01', 3, 50);

      const buffer = service.exportProfit(undefined, 'csv');
      const csvContent = buffer.toString('utf-8');
      expect(csvContent).toContain('分类');
      expect(csvContent).toContain('净利润');
    });

    it('按分类筛选利润统计', () => {
      const data1 = createTestData({ category: '文学' });
      const data2 = createTestData({ category: '科技' });
      createInboundRecord(data1.bookId, data1.editionId, data1.locationId, '2024-01-01', 10, 20);
      createOutboundRecord(data1.bookId, data1.editionId, data1.locationId, '2024-02-01', 8, 35);
      createInboundRecord(data2.bookId, data2.editionId, data2.locationId, '2024-01-01', 5, 30);
      createOutboundRecord(data2.bookId, data2.editionId, data2.locationId, '2024-02-01', 3, 50);

      const buffer = service.exportProfit({ category: '文学' }, 'xlsx');
      const rows = parseXlsxBuffer(buffer);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveProperty('分类', '文学');
    });

    it('按日期范围筛选利润统计', () => {
      const { bookId, editionId, locationId } = createTestData({ category: '文学' });
      createInboundRecord(bookId, editionId, locationId, '2024-01-01', 10, 20);
      createInboundRecord(bookId, editionId, locationId, '2024-03-01', 5, 30);
      createOutboundRecord(bookId, editionId, locationId, '2024-03-15', 3, 50);

      const buffer = service.exportProfit(
        { dateRange: { startDate: '2024-02-01', endDate: '2024-04-01' } },
        'xlsx',
      );
      const rows = parseXlsxBuffer(buffer);
      expect(rows).toHaveLength(1);
      // 只计算日期范围内：成本 5*30=150，收入 3*50=150，净利润 0
      expect(rows[0]).toHaveProperty('总采购成本', 150);
      expect(rows[0]).toHaveProperty('总销售收入', 150);
      expect(rows[0]).toHaveProperty('净利润', 0);
    });

    it('无入库出库记录的分类不导出', () => {
      // 创建一个有数据的分类和一个无数据的分类
      const data1 = createTestData({ category: '文学' });
      createTestData({ category: '空分类' }); // 无入库出库记录

      createInboundRecord(data1.bookId, data1.editionId, data1.locationId, '2024-01-01', 10, 20);

      const buffer = service.exportProfit(undefined, 'xlsx');
      const rows = parseXlsxBuffer(buffer);
      // 只有文学分类有数据
      const categories = rows.map((r) => r['分类']);
      expect(categories).toContain('文学');
      expect(categories).not.toContain('空分类');
    });
  });
});
