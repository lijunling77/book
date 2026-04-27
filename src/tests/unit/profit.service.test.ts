/**
 * ProfitService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeDatabase, closeDatabase, getSqliteDatabase } from '../../main/db';
import { ProfitService } from '../../main/services/profit.service';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import os from 'os';

function getTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'profit-svc-test-'));
  return path.join(dir, 'test.db');
}

/** 创建测试用的书籍、版本和位置 */
function createTestData(options?: { category?: string; isbn?: string }) {
  const sqlite = getSqliteDatabase();
  const bookId = uuidv4();
  const editionId = uuidv4();
  const locationId = uuidv4();
  const category = options?.category ?? '测试分类';
  const isbn = options?.isbn ?? `ISBN-${bookId.substring(0, 8)}`;

  sqlite
    .prepare('INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)')
    .run(bookId, '测试书籍', '测试作者', isbn, category);

  sqlite
    .prepare('INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)')
    .run(editionId, bookId, '精装');

  sqlite
    .prepare('INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)')
    .run(locationId, '仓库A', `书架-${locationId.substring(0, 6)}`, '层1');

  return { bookId, editionId, locationId };
}

/** 为同一书籍创建第二个版本 */
function createSecondEdition(bookId: string) {
  const sqlite = getSqliteDatabase();
  const editionId = uuidv4();
  sqlite
    .prepare('INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)')
    .run(editionId, bookId, '平装');
  return editionId;
}

/** 创建入库记录 */
function createInboundRecord(
  bookId: string,
  editionId: string,
  locationId: string,
  date: string,
  quantity: number,
  price: number,
): void {
  const sqlite = getSqliteDatabase();
  sqlite
    .prepare(
      'INSERT INTO inbound_records (id, book_id, edition_id, location_id, inbound_date, quantity, purchase_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(uuidv4(), bookId, editionId, locationId, date, quantity, price);
}

/** 创建出库记录 */
function createOutboundRecord(
  bookId: string,
  editionId: string,
  locationId: string,
  date: string,
  quantity: number,
  price: number,
): void {
  const sqlite = getSqliteDatabase();
  sqlite
    .prepare(
      'INSERT INTO outbound_records (id, book_id, edition_id, location_id, outbound_date, quantity, selling_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(uuidv4(), bookId, editionId, locationId, date, quantity, price);
}

describe('ProfitService', () => {
  let service: ProfitService;

  beforeEach(() => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    service = new ProfitService();
  });

  afterEach(() => {
    closeDatabase();
  });

  // ============================================================
  // calculateByStockUnit
  // ============================================================

  describe('calculateByStockUnit', () => {
    it('无记录时成本、收入和利润都为 0', () => {
      const { bookId, editionId } = createTestData();
      const result = service.calculateByStockUnit(bookId, editionId);

      expect(result.totalPurchaseCost).toBe(0);
      expect(result.totalSalesRevenue).toBe(0);
      expect(result.netProfit).toBe(0);
    });

    it('应正确计算总采购成本', () => {
      const { bookId, editionId, locationId } = createTestData();
      // 成本 = 20*10 + 30*5 = 200 + 150 = 350
      createInboundRecord(bookId, editionId, locationId, '2024-01-01', 10, 20);
      createInboundRecord(bookId, editionId, locationId, '2024-02-01', 5, 30);

      const result = service.calculateByStockUnit(bookId, editionId);
      expect(result.totalPurchaseCost).toBe(350);
    });

    it('应正确计算总销售收入', () => {
      const { bookId, editionId, locationId } = createTestData();
      // 收入 = 50*3 + 60*7 = 150 + 420 = 570
      createOutboundRecord(bookId, editionId, locationId, '2024-01-15', 3, 50);
      createOutboundRecord(bookId, editionId, locationId, '2024-02-15', 7, 60);

      const result = service.calculateByStockUnit(bookId, editionId);
      expect(result.totalSalesRevenue).toBe(570);
    });

    it('应正确计算净利润（收入 - 成本）', () => {
      const { bookId, editionId, locationId } = createTestData();
      createInboundRecord(bookId, editionId, locationId, '2024-01-01', 10, 20); // 成本 200
      createOutboundRecord(bookId, editionId, locationId, '2024-02-01', 8, 35); // 收入 280

      const result = service.calculateByStockUnit(bookId, editionId);
      expect(result.totalPurchaseCost).toBe(200);
      expect(result.totalSalesRevenue).toBe(280);
      expect(result.netProfit).toBe(80);
    });

    it('净利润可以为负数（亏损）', () => {
      const { bookId, editionId, locationId } = createTestData();
      createInboundRecord(bookId, editionId, locationId, '2024-01-01', 10, 50); // 成本 500
      createOutboundRecord(bookId, editionId, locationId, '2024-02-01', 5, 30); // 收入 150

      const result = service.calculateByStockUnit(bookId, editionId);
      expect(result.netProfit).toBe(-350);
    });

    it('按日期范围筛选入库记录', () => {
      const { bookId, editionId, locationId } = createTestData();
      createInboundRecord(bookId, editionId, locationId, '2024-01-01', 10, 20); // 范围外
      createInboundRecord(bookId, editionId, locationId, '2024-03-01', 5, 30);  // 范围内
      createInboundRecord(bookId, editionId, locationId, '2024-05-01', 3, 40);  // 范围外

      const result = service.calculateByStockUnit(bookId, editionId, {
        startDate: '2024-02-01',
        endDate: '2024-04-01',
      });
      // 只计算 2024-03-01 的记录：5 * 30 = 150
      expect(result.totalPurchaseCost).toBe(150);
    });

    it('按日期范围筛选出库记录', () => {
      const { bookId, editionId, locationId } = createTestData();
      createOutboundRecord(bookId, editionId, locationId, '2024-01-15', 3, 50); // 范围外
      createOutboundRecord(bookId, editionId, locationId, '2024-03-15', 2, 60); // 范围内

      const result = service.calculateByStockUnit(bookId, editionId, {
        startDate: '2024-02-01',
        endDate: '2024-04-01',
      });
      // 只计算 2024-03-15 的记录：2 * 60 = 120
      expect(result.totalSalesRevenue).toBe(120);
    });

    it('不应包含其他库存单元的记录', () => {
      const data1 = createTestData();
      const data2 = createTestData();

      createInboundRecord(data1.bookId, data1.editionId, data1.locationId, '2024-01-01', 10, 20);
      createInboundRecord(data2.bookId, data2.editionId, data2.locationId, '2024-01-01', 5, 100);

      const result = service.calculateByStockUnit(data1.bookId, data1.editionId);
      expect(result.totalPurchaseCost).toBe(200);
    });
  });

  // ============================================================
  // calculateByBook
  // ============================================================

  describe('calculateByBook', () => {
    it('无记录时返回零值', () => {
      const { bookId } = createTestData();
      const result = service.calculateByBook(bookId);

      expect(result.totalPurchaseCost).toBe(0);
      expect(result.totalSalesRevenue).toBe(0);
      expect(result.netProfit).toBe(0);
    });

    it('应汇总书籍所有版本的利润', () => {
      const { bookId, editionId, locationId } = createTestData();
      const edition2Id = createSecondEdition(bookId);

      // 版本1：成本 200，收入 280
      createInboundRecord(bookId, editionId, locationId, '2024-01-01', 10, 20);
      createOutboundRecord(bookId, editionId, locationId, '2024-02-01', 8, 35);

      // 版本2：成本 150，收入 300
      createInboundRecord(bookId, edition2Id, locationId, '2024-01-01', 5, 30);
      createOutboundRecord(bookId, edition2Id, locationId, '2024-02-01', 6, 50);

      const result = service.calculateByBook(bookId);
      expect(result.totalPurchaseCost).toBe(350);  // 200 + 150
      expect(result.totalSalesRevenue).toBe(580);   // 280 + 300
      expect(result.netProfit).toBe(230);            // 580 - 350
    });

    it('按日期范围筛选', () => {
      const { bookId, editionId, locationId } = createTestData();

      createInboundRecord(bookId, editionId, locationId, '2024-01-01', 10, 20); // 范围外
      createInboundRecord(bookId, editionId, locationId, '2024-03-01', 5, 30);  // 范围内
      createOutboundRecord(bookId, editionId, locationId, '2024-03-15', 3, 50); // 范围内

      const result = service.calculateByBook(bookId, {
        startDate: '2024-02-01',
        endDate: '2024-04-01',
      });
      expect(result.totalPurchaseCost).toBe(150);  // 5 * 30
      expect(result.totalSalesRevenue).toBe(150);   // 3 * 50
      expect(result.netProfit).toBe(0);
    });
  });

  // ============================================================
  // calculateByCategory
  // ============================================================

  describe('calculateByCategory', () => {
    it('分类下无书籍时返回零值', () => {
      const result = service.calculateByCategory('不存在的分类');

      expect(result.totalPurchaseCost).toBe(0);
      expect(result.totalSalesRevenue).toBe(0);
      expect(result.netProfit).toBe(0);
    });

    it('应汇总分类下所有书籍的利润', () => {
      const data1 = createTestData({ category: '文学' });
      const data2 = createTestData({ category: '文学' });

      // 书籍1：成本 200，收入 280
      createInboundRecord(data1.bookId, data1.editionId, data1.locationId, '2024-01-01', 10, 20);
      createOutboundRecord(data1.bookId, data1.editionId, data1.locationId, '2024-02-01', 8, 35);

      // 书籍2：成本 150，收入 300
      createInboundRecord(data2.bookId, data2.editionId, data2.locationId, '2024-01-01', 5, 30);
      createOutboundRecord(data2.bookId, data2.editionId, data2.locationId, '2024-02-01', 6, 50);

      const result = service.calculateByCategory('文学');
      expect(result.totalPurchaseCost).toBe(350);  // 200 + 150
      expect(result.totalSalesRevenue).toBe(580);   // 280 + 300
      expect(result.netProfit).toBe(230);            // 580 - 350
    });

    it('不应包含其他分类的书籍', () => {
      const data1 = createTestData({ category: '文学' });
      const data2 = createTestData({ category: '科技' });

      createInboundRecord(data1.bookId, data1.editionId, data1.locationId, '2024-01-01', 10, 20);
      createInboundRecord(data2.bookId, data2.editionId, data2.locationId, '2024-01-01', 5, 100);

      const result = service.calculateByCategory('文学');
      expect(result.totalPurchaseCost).toBe(200);
    });

    it('按日期范围筛选', () => {
      const data1 = createTestData({ category: '历史' });

      createInboundRecord(data1.bookId, data1.editionId, data1.locationId, '2024-01-01', 10, 20); // 范围外
      createInboundRecord(data1.bookId, data1.editionId, data1.locationId, '2024-03-01', 5, 30);  // 范围内
      createOutboundRecord(data1.bookId, data1.editionId, data1.locationId, '2024-03-15', 3, 50); // 范围内

      const result = service.calculateByCategory('历史', {
        startDate: '2024-02-01',
        endDate: '2024-04-01',
      });
      expect(result.totalPurchaseCost).toBe(150);
      expect(result.totalSalesRevenue).toBe(150);
      expect(result.netProfit).toBe(0);
    });
  });
});
