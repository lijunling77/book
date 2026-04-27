/**
 * StockService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeDatabase, closeDatabase, getSqliteDatabase } from '../../main/db';
import { StockService } from '../../main/services/stock.service';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { ERROR_MESSAGES, STOCK_STATUS } from '../../shared/constants';

function getTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-svc-test-'));
  return path.join(dir, 'test.db');
}

/** 创建测试用的书籍、版本和位置，返回它们的 ID */
function createTestData() {
  const sqlite = getSqliteDatabase();
  const bookId = uuidv4();
  const editionId = uuidv4();
  const locationId = uuidv4();

  sqlite
    .prepare('INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)')
    .run(bookId, '测试书籍', '测试作者', `ISBN-${bookId.substring(0, 8)}`, '测试分类');

  sqlite
    .prepare('INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)')
    .run(editionId, bookId, '精装');

  sqlite
    .prepare('INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)')
    .run(locationId, '仓库A', `书架-${locationId.substring(0, 6)}`, '层1');

  return { bookId, editionId, locationId };
}

describe('StockService', () => {
  let service: StockService;

  beforeEach(() => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    service = new StockService();
  });

  afterEach(() => {
    closeDatabase();
  });

  // ============================================================
  // getStockQuantity
  // ============================================================

  describe('getStockQuantity', () => {
    it('库存记录不存在时应返回 0', () => {
      const { bookId, editionId, locationId } = createTestData();
      const qty = service.getStockQuantity(bookId, editionId, locationId);
      expect(qty).toBe(0);
    });

    it('应返回正确的库存数量', () => {
      const { bookId, editionId, locationId } = createTestData();
      const sqlite = getSqliteDatabase();
      sqlite
        .prepare('INSERT INTO stock (id, book_id, edition_id, location_id, quantity) VALUES (?, ?, ?, ?, ?)')
        .run(uuidv4(), bookId, editionId, locationId, 10);

      const qty = service.getStockQuantity(bookId, editionId, locationId);
      expect(qty).toBe(10);
    });
  });

  // ============================================================
  // adjustStock
  // ============================================================

  describe('adjustStock', () => {
    it('库存记录不存在且 delta > 0 时应创建新记录', () => {
      const { bookId, editionId, locationId } = createTestData();

      service.adjustStock(bookId, editionId, locationId, 5);

      const qty = service.getStockQuantity(bookId, editionId, locationId);
      expect(qty).toBe(5);
    });

    it('应正确增加库存数量', () => {
      const { bookId, editionId, locationId } = createTestData();
      service.adjustStock(bookId, editionId, locationId, 10);
      service.adjustStock(bookId, editionId, locationId, 5);

      const qty = service.getStockQuantity(bookId, editionId, locationId);
      expect(qty).toBe(15);
    });

    it('应正确减少库存数量', () => {
      const { bookId, editionId, locationId } = createTestData();
      service.adjustStock(bookId, editionId, locationId, 10);
      service.adjustStock(bookId, editionId, locationId, -3);

      const qty = service.getStockQuantity(bookId, editionId, locationId);
      expect(qty).toBe(7);
    });

    it('调整后库存为负时应抛出异常', () => {
      const { bookId, editionId, locationId } = createTestData();
      service.adjustStock(bookId, editionId, locationId, 5);

      expect(() => service.adjustStock(bookId, editionId, locationId, -10)).toThrow(
        ERROR_MESSAGES.STOCK_WOULD_BE_NEGATIVE,
      );

      // 库存应保持不变
      const qty = service.getStockQuantity(bookId, editionId, locationId);
      expect(qty).toBe(5);
    });

    it('库存记录不存在且 delta < 0 时应抛出异常', () => {
      const { bookId, editionId, locationId } = createTestData();

      expect(() => service.adjustStock(bookId, editionId, locationId, -1)).toThrow(
        ERROR_MESSAGES.STOCK_WOULD_BE_NEGATIVE,
      );
    });

    it('delta 为 0 且记录不存在时不应创建记录', () => {
      const { bookId, editionId, locationId } = createTestData();

      service.adjustStock(bookId, editionId, locationId, 0);

      const sqlite = getSqliteDatabase();
      const record = sqlite
        .prepare('SELECT * FROM stock WHERE book_id = ? AND edition_id = ? AND location_id = ?')
        .get(bookId, editionId, locationId);

      expect(record).toBeUndefined();
    });

    it('调整到恰好为 0 时应成功', () => {
      const { bookId, editionId, locationId } = createTestData();
      service.adjustStock(bookId, editionId, locationId, 5);
      service.adjustStock(bookId, editionId, locationId, -5);

      const qty = service.getStockQuantity(bookId, editionId, locationId);
      expect(qty).toBe(0);
    });
  });

  // ============================================================
  // getTotalStock
  // ============================================================

  describe('getTotalStock', () => {
    it('无库存记录时应返回 0', () => {
      const { bookId, editionId } = createTestData();
      const total = service.getTotalStock(bookId, editionId);
      expect(total).toBe(0);
    });

    it('应返回所有位置的库存总量', () => {
      const sqlite = getSqliteDatabase();
      const bookId = uuidv4();
      const editionId = uuidv4();
      const loc1 = uuidv4();
      const loc2 = uuidv4();

      sqlite
        .prepare('INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)')
        .run(bookId, '多位置书籍', '作者', `ISBN-MULTI-${bookId.substring(0, 6)}`, '分类');
      sqlite
        .prepare('INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)')
        .run(editionId, bookId, '精装');
      sqlite
        .prepare('INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)')
        .run(loc1, '仓库A', `架-${loc1.substring(0, 4)}`, '层1');
      sqlite
        .prepare('INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)')
        .run(loc2, '仓库B', `架-${loc2.substring(0, 4)}`, '层2');

      service.adjustStock(bookId, editionId, loc1, 10);
      service.adjustStock(bookId, editionId, loc2, 20);

      const total = service.getTotalStock(bookId, editionId);
      expect(total).toBe(30);
    });
  });

  // ============================================================
  // list
  // ============================================================

  describe('list', () => {
    it('无库存数据时应返回空列表', () => {
      const result = service.list();
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('应返回库存列表并包含关联信息', () => {
      const { bookId, editionId, locationId } = createTestData();
      service.adjustStock(bookId, editionId, locationId, 10);

      const result = service.list();
      expect(result.data).toHaveLength(1);

      const item = result.data[0];
      expect(item.bookId).toBe(bookId);
      expect(item.editionId).toBe(editionId);
      expect(item.locationId).toBe(locationId);
      expect(item.quantity).toBe(10);
      expect(item.status).toBe(STOCK_STATUS.NORMAL);
      expect(item.bookTitle).toBe('测试书籍');
      expect(item.editionName).toBe('精装');
      expect(item.warehouse).toBe('仓库A');
    });

    it('库存为零时应标记为缺货', () => {
      const { bookId, editionId, locationId } = createTestData();
      // 创建一条库存为 0 的记录
      const sqlite = getSqliteDatabase();
      sqlite
        .prepare('INSERT INTO stock (id, book_id, edition_id, location_id, quantity) VALUES (?, ?, ?, ?, ?)')
        .run(uuidv4(), bookId, editionId, locationId, 0);

      const result = service.list();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe(STOCK_STATUS.OUT_OF_STOCK);
    });

    it('应支持按书名筛选', () => {
      const { bookId, editionId, locationId } = createTestData();
      service.adjustStock(bookId, editionId, locationId, 5);

      const result = service.list({ bookTitle: '测试书籍' });
      expect(result.data).toHaveLength(1);

      const noResult = service.list({ bookTitle: '不存在的书' });
      expect(noResult.data).toHaveLength(0);
    });

    it('应支持分页', () => {
      // 创建多条库存记录
      for (let i = 0; i < 3; i++) {
        const { bookId, editionId, locationId } = createTestData();
        service.adjustStock(bookId, editionId, locationId, i + 1);
      }

      const page1 = service.list({ page: 1, pageSize: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.total).toBe(3);

      const page2 = service.list({ page: 2, pageSize: 2 });
      expect(page2.data).toHaveLength(1);
    });

    it('无入库/出库记录时价格信息应为 null', () => {
      const { bookId, editionId, locationId } = createTestData();
      service.adjustStock(bookId, editionId, locationId, 5);

      const result = service.list();
      const item = result.data[0];
      expect(item.latestPurchasePrice).toBeNull();
      expect(item.latestSellingPrice).toBeNull();
      expect(item.purchasePriceMin).toBeNull();
      expect(item.purchasePriceMax).toBeNull();
      expect(item.averagePurchasePrice).toBeNull();
      expect(item.averageSellingPrice).toBeNull();
    });

    it('应正确计算价格统计信息', () => {
      const { bookId, editionId, locationId } = createTestData();
      service.adjustStock(bookId, editionId, locationId, 15);

      const sqlite = getSqliteDatabase();
      // 创建入库记录
      sqlite
        .prepare('INSERT INTO inbound_records (id, book_id, edition_id, location_id, inbound_date, quantity, purchase_price) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(uuidv4(), bookId, editionId, locationId, '2024-01-01', 10, 20.0);
      sqlite
        .prepare('INSERT INTO inbound_records (id, book_id, edition_id, location_id, inbound_date, quantity, purchase_price) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(uuidv4(), bookId, editionId, locationId, '2024-02-01', 5, 30.0);

      // 创建出库记录
      sqlite
        .prepare('INSERT INTO outbound_records (id, book_id, edition_id, location_id, outbound_date, quantity, selling_price) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(uuidv4(), bookId, editionId, locationId, '2024-03-01', 3, 50.0);

      const result = service.list();
      const item = result.data[0];

      // 最近买入价格应为 30.0（2024-02-01 的记录）
      expect(item.latestPurchasePrice).toBe(30.0);
      // 最近售出价格应为 50.0
      expect(item.latestSellingPrice).toBe(50.0);
      // 买入价格范围
      expect(item.purchasePriceMin).toBe(20.0);
      expect(item.purchasePriceMax).toBe(30.0);
      // 加权平均买入价格 = (20*10 + 30*5) / (10+5) = 350/15 ≈ 23.33
      expect(item.averagePurchasePrice).toBeCloseTo(23.33, 1);
      // 平均售出价格 = 50.0
      expect(item.averageSellingPrice).toBe(50.0);
    });
  });

  // ============================================================
  // summary
  // ============================================================

  describe('summary', () => {
    it('无库存数据时应返回空数组', () => {
      const result = service.summary();
      expect(result).toHaveLength(0);
    });

    it('应汇总同一库存单元在不同位置的总数量', () => {
      const sqlite = getSqliteDatabase();
      const bookId = uuidv4();
      const editionId = uuidv4();
      const loc1 = uuidv4();
      const loc2 = uuidv4();

      sqlite
        .prepare('INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)')
        .run(bookId, '汇总测试', '作者', `ISBN-SUM-${bookId.substring(0, 6)}`, '分类');
      sqlite
        .prepare('INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)')
        .run(editionId, bookId, '精装');
      sqlite
        .prepare('INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)')
        .run(loc1, '仓库A', `架-${loc1.substring(0, 4)}`, '层1');
      sqlite
        .prepare('INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)')
        .run(loc2, '仓库B', `架-${loc2.substring(0, 4)}`, '层2');

      service.adjustStock(bookId, editionId, loc1, 10);
      service.adjustStock(bookId, editionId, loc2, 20);

      const result = service.summary();
      expect(result).toHaveLength(1);
      expect(result[0].bookId).toBe(bookId);
      expect(result[0].editionId).toBe(editionId);
      expect(result[0].totalQuantity).toBe(30);
      expect(result[0].bookTitle).toBe('汇总测试');
      expect(result[0].editionName).toBe('精装');
    });

    it('应支持按书名筛选', () => {
      const { bookId, editionId, locationId } = createTestData();
      service.adjustStock(bookId, editionId, locationId, 5);

      const result = service.summary({ bookTitle: '测试书籍' });
      expect(result).toHaveLength(1);

      const noResult = service.summary({ bookTitle: '不存在' });
      expect(noResult).toHaveLength(0);
    });

    it('应正确显示预警状态', () => {
      const sqlite = getSqliteDatabase();
      const bookId = uuidv4();
      const editionId = uuidv4();
      const locationId = uuidv4();

      sqlite
        .prepare('INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)')
        .run(bookId, '预警测试', '作者', `ISBN-ALERT-${bookId.substring(0, 6)}`, '分类');
      sqlite
        .prepare('INSERT INTO editions (id, book_id, name, alert_threshold) VALUES (?, ?, ?, ?)')
        .run(editionId, bookId, '精装', 10);
      sqlite
        .prepare('INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)')
        .run(locationId, '仓库A', `架-${locationId.substring(0, 4)}`, '层1');

      // 库存 5 < 阈值 10，应触发预警
      service.adjustStock(bookId, editionId, locationId, 5);

      const result = service.summary();
      expect(result).toHaveLength(1);
      expect(result[0].isAlert).toBe(true);
      expect(result[0].alertThreshold).toBe(10);
    });
  });
});
