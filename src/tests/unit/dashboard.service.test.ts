/**
 * DashboardService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeDatabase, closeDatabase, getSqliteDatabase } from '../../main/db';
import { DashboardService } from '../../main/services/dashboard.service';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import os from 'os';

function getTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-svc-test-'));
  return path.join(dir, 'test.db');
}

/** 获取今天的日期字符串 YYYY-MM-DD */
function getToday(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 获取本月某一天的日期字符串 */
function getThisMonthDate(day: number): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-${String(day).padStart(2, '0')}`;
}

/** 创建测试用的书籍、版本和位置 */
function createTestData(options?: { alertThreshold?: number | null }) {
  const sqlite = getSqliteDatabase();
  const bookId = uuidv4();
  const editionId = uuidv4();
  const locationId = uuidv4();

  sqlite
    .prepare('INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)')
    .run(bookId, '测试书籍', '测试作者', `ISBN-${bookId.substring(0, 8)}`, '测试分类');

  sqlite
    .prepare('INSERT INTO editions (id, book_id, name, alert_threshold) VALUES (?, ?, ?, ?)')
    .run(editionId, bookId, '精装', options?.alertThreshold ?? null);

  sqlite
    .prepare('INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)')
    .run(locationId, '仓库A', `书架-${locationId.substring(0, 6)}`, '层1');

  return { bookId, editionId, locationId };
}

/** 创建库存记录 */
function createStock(bookId: string, editionId: string, locationId: string, quantity: number): void {
  const sqlite = getSqliteDatabase();
  sqlite
    .prepare('INSERT INTO stock (id, book_id, edition_id, location_id, quantity) VALUES (?, ?, ?, ?, ?)')
    .run(uuidv4(), bookId, editionId, locationId, quantity);
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

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(() => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    service = new DashboardService();
  });

  afterEach(() => {
    closeDatabase();
  });

  describe('getData - 无数据时', () => {
    it('所有指标应为零，预警列表为空', () => {
      const result = service.getData();

      expect(result.totalStockQuantity).toBe(0);
      expect(result.alertStockUnitCount).toBe(0);
      expect(result.todayInboundQuantity).toBe(0);
      expect(result.todayInboundAmount).toBe(0);
      expect(result.todayOutboundQuantity).toBe(0);
      expect(result.todayOutboundAmount).toBe(0);
      expect(result.monthlyProfit).toBe(0);
      expect(result.alertStockUnits).toEqual([]);
    });
  });

  describe('getData - 总库存量', () => {
    it('应正确计算所有库存单元的总库存量', () => {
      const data1 = createTestData();
      const data2 = createTestData();

      createStock(data1.bookId, data1.editionId, data1.locationId, 10);
      createStock(data2.bookId, data2.editionId, data2.locationId, 25);

      const result = service.getData();
      expect(result.totalStockQuantity).toBe(35);
    });
  });

  describe('getData - 今日入库', () => {
    it('应正确计算今日入库数量和金额', () => {
      const { bookId, editionId, locationId } = createTestData();
      const today = getToday();

      createInboundRecord(bookId, editionId, locationId, today, 10, 20);
      createInboundRecord(bookId, editionId, locationId, today, 5, 30);

      const result = service.getData();
      expect(result.todayInboundQuantity).toBe(15);
      // 金额 = 10*20 + 5*30 = 200 + 150 = 350
      expect(result.todayInboundAmount).toBe(350);
    });

    it('不应包含非今日的入库记录', () => {
      const { bookId, editionId, locationId } = createTestData();
      const today = getToday();

      createInboundRecord(bookId, editionId, locationId, today, 10, 20);
      createInboundRecord(bookId, editionId, locationId, '2023-01-01', 100, 50);

      const result = service.getData();
      expect(result.todayInboundQuantity).toBe(10);
      expect(result.todayInboundAmount).toBe(200);
    });
  });

  describe('getData - 今日出库', () => {
    it('应正确计算今日出库数量和金额', () => {
      const { bookId, editionId, locationId } = createTestData();
      const today = getToday();

      createOutboundRecord(bookId, editionId, locationId, today, 3, 50);
      createOutboundRecord(bookId, editionId, locationId, today, 7, 60);

      const result = service.getData();
      expect(result.todayOutboundQuantity).toBe(10);
      // 金额 = 3*50 + 7*60 = 150 + 420 = 570
      expect(result.todayOutboundAmount).toBe(570);
    });

    it('不应包含非今日的出库记录', () => {
      const { bookId, editionId, locationId } = createTestData();
      const today = getToday();

      createOutboundRecord(bookId, editionId, locationId, today, 3, 50);
      createOutboundRecord(bookId, editionId, locationId, '2023-06-15', 100, 80);

      const result = service.getData();
      expect(result.todayOutboundQuantity).toBe(3);
      expect(result.todayOutboundAmount).toBe(150);
    });
  });

  describe('getData - 本月利润', () => {
    it('应正确计算本月利润（出库收入 - 入库成本）', () => {
      const { bookId, editionId, locationId } = createTestData();
      const thisMonth1 = getThisMonthDate(1);
      const thisMonth5 = getThisMonthDate(5);

      // 本月入库成本 = 10*20 = 200
      createInboundRecord(bookId, editionId, locationId, thisMonth1, 10, 20);
      // 本月出库收入 = 8*35 = 280
      createOutboundRecord(bookId, editionId, locationId, thisMonth5, 8, 35);

      const result = service.getData();
      expect(result.monthlyProfit).toBe(80); // 280 - 200
    });

    it('不应包含非本月的记录', () => {
      const { bookId, editionId, locationId } = createTestData();
      const thisMonth1 = getThisMonthDate(1);

      // 本月入库成本 = 5*30 = 150
      createInboundRecord(bookId, editionId, locationId, thisMonth1, 5, 30);
      // 上个月的出库记录不应计入
      createOutboundRecord(bookId, editionId, locationId, '2023-01-15', 100, 80);

      const result = service.getData();
      expect(result.monthlyProfit).toBe(-150); // 0 - 150
    });
  });

  describe('getData - 预警列表', () => {
    it('应返回处于预警状态的库存单元', () => {
      const { bookId, editionId, locationId } = createTestData({ alertThreshold: 10 });
      createStock(bookId, editionId, locationId, 5); // 5 <= 10，触发预警

      const result = service.getData();
      expect(result.alertStockUnitCount).toBe(1);
      expect(result.alertStockUnits).toHaveLength(1);
      expect(result.alertStockUnits[0].bookId).toBe(bookId);
      expect(result.alertStockUnits[0].editionId).toBe(editionId);
      expect(result.alertStockUnits[0].totalQuantity).toBe(5);
      expect(result.alertStockUnits[0].alertThreshold).toBe(10);
    });

    it('未设置预警阈值的库存单元不应出现在预警列表中', () => {
      const { bookId, editionId, locationId } = createTestData({ alertThreshold: null });
      createStock(bookId, editionId, locationId, 0);

      const result = service.getData();
      expect(result.alertStockUnitCount).toBe(0);
      expect(result.alertStockUnits).toEqual([]);
    });

    it('库存高于预警阈值时不应出现在预警列表中', () => {
      const { bookId, editionId, locationId } = createTestData({ alertThreshold: 5 });
      createStock(bookId, editionId, locationId, 20); // 20 > 5，不触发预警

      const result = service.getData();
      expect(result.alertStockUnitCount).toBe(0);
      expect(result.alertStockUnits).toEqual([]);
    });
  });
});
