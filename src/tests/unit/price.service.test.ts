/**
 * PriceService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeDatabase, closeDatabase, getSqliteDatabase } from '../../main/db';
import { PriceService } from '../../main/services/price.service';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import os from 'os';

function getTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'price-svc-test-'));
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

/** 创建入库记录 */
function createInboundRecord(
  bookId: string,
  editionId: string,
  locationId: string,
  date: string,
  quantity: number,
  price: number,
  supplier: string | null = null,
): string {
  const sqlite = getSqliteDatabase();
  const id = uuidv4();
  sqlite
    .prepare(
      'INSERT INTO inbound_records (id, book_id, edition_id, location_id, inbound_date, quantity, purchase_price, supplier) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(id, bookId, editionId, locationId, date, quantity, price, supplier);
  return id;
}

/** 创建出库记录 */
function createOutboundRecord(
  bookId: string,
  editionId: string,
  locationId: string,
  date: string,
  quantity: number,
  price: number,
  buyer: string | null = null,
): string {
  const sqlite = getSqliteDatabase();
  const id = uuidv4();
  sqlite
    .prepare(
      'INSERT INTO outbound_records (id, book_id, edition_id, location_id, outbound_date, quantity, selling_price, buyer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(id, bookId, editionId, locationId, date, quantity, price, buyer);
  return id;
}

describe('PriceService', () => {
  let service: PriceService;

  beforeEach(() => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    service = new PriceService();
  });

  afterEach(() => {
    closeDatabase();
  });

  // ============================================================
  // getPurchaseHistory
  // ============================================================

  describe('getPurchaseHistory', () => {
    it('无入库记录时应返回空数组', () => {
      const { bookId, editionId } = createTestData();
      const result = service.getPurchaseHistory(bookId, editionId);
      expect(result).toHaveLength(0);
    });

    it('应返回所有入库记录的价格历史', () => {
      const { bookId, editionId, locationId } = createTestData();
      createInboundRecord(bookId, editionId, locationId, '2024-01-01', 10, 20.0, '供应商A');
      createInboundRecord(bookId, editionId, locationId, '2024-02-01', 5, 30.0, '供应商B');

      const result = service.getPurchaseHistory(bookId, editionId);
      expect(result).toHaveLength(2);
      expect(result[0].purchasePrice).toBe(30.0);
      expect(result[0].inboundDate).toBe('2024-02-01');
      expect(result[0].quantity).toBe(5);
      expect(result[0].supplier).toBe('供应商B');
      expect(result[1].purchasePrice).toBe(20.0);
      expect(result[1].inboundDate).toBe('2024-01-01');
      expect(result[1].quantity).toBe(10);
      expect(result[1].supplier).toBe('供应商A');
    });

    it('应按日期倒序排列', () => {
      const { bookId, editionId, locationId } = createTestData();
      createInboundRecord(bookId, editionId, locationId, '2024-03-01', 1, 10.0);
      createInboundRecord(bookId, editionId, locationId, '2024-01-01', 2, 20.0);
      createInboundRecord(bookId, editionId, locationId, '2024-02-01', 3, 15.0);

      const result = service.getPurchaseHistory(bookId, editionId);
      expect(result).toHaveLength(3);
      expect(result[0].inboundDate).toBe('2024-03-01');
      expect(result[1].inboundDate).toBe('2024-02-01');
      expect(result[2].inboundDate).toBe('2024-01-01');
    });

    it('不应返回其他库存单元的记录', () => {
      const { bookId, editionId, locationId } = createTestData();
      const other = createTestData();

      createInboundRecord(bookId, editionId, locationId, '2024-01-01', 10, 20.0);
      createInboundRecord(other.bookId, other.editionId, other.locationId, '2024-01-01', 5, 30.0);

      const result = service.getPurchaseHistory(bookId, editionId);
      expect(result).toHaveLength(1);
      expect(result[0].purchasePrice).toBe(20.0);
    });
  });

  // ============================================================
  // getSellingHistory
  // ============================================================

  describe('getSellingHistory', () => {
    it('无出库记录时应返回空数组', () => {
      const { bookId, editionId } = createTestData();
      const result = service.getSellingHistory(bookId, editionId);
      expect(result).toHaveLength(0);
    });

    it('应返回所有出库记录的价格历史', () => {
      const { bookId, editionId, locationId } = createTestData();
      createOutboundRecord(bookId, editionId, locationId, '2024-01-15', 3, 50.0, '买家A');
      createOutboundRecord(bookId, editionId, locationId, '2024-02-15', 2, 60.0, '买家B');

      const result = service.getSellingHistory(bookId, editionId);
      expect(result).toHaveLength(2);
      expect(result[0].sellingPrice).toBe(60.0);
      expect(result[0].outboundDate).toBe('2024-02-15');
      expect(result[0].quantity).toBe(2);
      expect(result[0].buyer).toBe('买家B');
      expect(result[1].sellingPrice).toBe(50.0);
      expect(result[1].outboundDate).toBe('2024-01-15');
      expect(result[1].quantity).toBe(3);
      expect(result[1].buyer).toBe('买家A');
    });

    it('应按日期倒序排列', () => {
      const { bookId, editionId, locationId } = createTestData();
      createOutboundRecord(bookId, editionId, locationId, '2024-03-01', 1, 40.0);
      createOutboundRecord(bookId, editionId, locationId, '2024-01-01', 2, 50.0);
      createOutboundRecord(bookId, editionId, locationId, '2024-02-01', 3, 45.0);

      const result = service.getSellingHistory(bookId, editionId);
      expect(result).toHaveLength(3);
      expect(result[0].outboundDate).toBe('2024-03-01');
      expect(result[1].outboundDate).toBe('2024-02-01');
      expect(result[2].outboundDate).toBe('2024-01-01');
    });
  });

  // ============================================================
  // getStats
  // ============================================================

  describe('getStats', () => {
    it('无记录时应返回暂无数据标识', () => {
      const { bookId, editionId } = createTestData();
      const stats = service.getStats(bookId, editionId);

      expect(stats.hasInboundRecords).toBe(false);
      expect(stats.hasOutboundRecords).toBe(false);
      expect(stats.latestPurchasePrice).toBeNull();
      expect(stats.latestSellingPrice).toBeNull();
      expect(stats.purchasePriceMin).toBeNull();
      expect(stats.purchasePriceMax).toBeNull();
      expect(stats.averagePurchasePrice).toBeNull();
      expect(stats.averageSellingPrice).toBeNull();
    });

    it('仅有入库记录时出库相关字段应为 null', () => {
      const { bookId, editionId, locationId } = createTestData();
      createInboundRecord(bookId, editionId, locationId, '2024-01-01', 10, 25.0);

      const stats = service.getStats(bookId, editionId);
      expect(stats.hasInboundRecords).toBe(true);
      expect(stats.hasOutboundRecords).toBe(false);
      expect(stats.latestPurchasePrice).toBe(25.0);
      expect(stats.latestSellingPrice).toBeNull();
      expect(stats.averageSellingPrice).toBeNull();
    });

    it('仅有出库记录时入库相关字段应为 null', () => {
      const { bookId, editionId, locationId } = createTestData();
      createOutboundRecord(bookId, editionId, locationId, '2024-01-01', 5, 50.0);

      const stats = service.getStats(bookId, editionId);
      expect(stats.hasInboundRecords).toBe(false);
      expect(stats.hasOutboundRecords).toBe(true);
      expect(stats.latestPurchasePrice).toBeNull();
      expect(stats.latestSellingPrice).toBe(50.0);
      expect(stats.purchasePriceMin).toBeNull();
      expect(stats.purchasePriceMax).toBeNull();
      expect(stats.averagePurchasePrice).toBeNull();
    });

    it('应正确计算最近买入/售出价格', () => {
      const { bookId, editionId, locationId } = createTestData();
      createInboundRecord(bookId, editionId, locationId, '2024-01-01', 10, 20.0);
      createInboundRecord(bookId, editionId, locationId, '2024-03-01', 5, 30.0);
      createOutboundRecord(bookId, editionId, locationId, '2024-02-01', 3, 40.0);
      createOutboundRecord(bookId, editionId, locationId, '2024-04-01', 2, 55.0);

      const stats = service.getStats(bookId, editionId);
      expect(stats.latestPurchasePrice).toBe(30.0);
      expect(stats.latestSellingPrice).toBe(55.0);
    });

    it('应正确计算买入价格范围', () => {
      const { bookId, editionId, locationId } = createTestData();
      createInboundRecord(bookId, editionId, locationId, '2024-01-01', 10, 15.0);
      createInboundRecord(bookId, editionId, locationId, '2024-02-01', 5, 35.0);
      createInboundRecord(bookId, editionId, locationId, '2024-03-01', 8, 25.0);

      const stats = service.getStats(bookId, editionId);
      expect(stats.purchasePriceMin).toBe(15.0);
      expect(stats.purchasePriceMax).toBe(35.0);
    });

    it('应正确计算加权平均买入价格', () => {
      const { bookId, editionId, locationId } = createTestData();
      // 加权平均 = (20*10 + 30*5) / (10+5) = (200+150)/15 = 350/15 ≈ 23.33
      createInboundRecord(bookId, editionId, locationId, '2024-01-01', 10, 20.0);
      createInboundRecord(bookId, editionId, locationId, '2024-02-01', 5, 30.0);

      const stats = service.getStats(bookId, editionId);
      expect(stats.averagePurchasePrice).toBeCloseTo(23.33, 1);
    });

    it('应正确计算加权平均售出价格', () => {
      const { bookId, editionId, locationId } = createTestData();
      // 加权平均 = (50*3 + 60*7) / (3+7) = (150+420)/10 = 570/10 = 57.0
      createOutboundRecord(bookId, editionId, locationId, '2024-01-01', 3, 50.0);
      createOutboundRecord(bookId, editionId, locationId, '2024-02-01', 7, 60.0);

      const stats = service.getStats(bookId, editionId);
      expect(stats.averageSellingPrice).toBeCloseTo(57.0, 1);
    });

    it('单条入库记录时加权平均应等于该记录价格', () => {
      const { bookId, editionId, locationId } = createTestData();
      createInboundRecord(bookId, editionId, locationId, '2024-01-01', 10, 25.0);

      const stats = service.getStats(bookId, editionId);
      expect(stats.averagePurchasePrice).toBe(25.0);
      expect(stats.purchasePriceMin).toBe(25.0);
      expect(stats.purchasePriceMax).toBe(25.0);
    });
  });
});
