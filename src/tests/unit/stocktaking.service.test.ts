/**
 * StocktakingService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeDatabase, closeDatabase, getSqliteDatabase } from '../../main/db';
import { StocktakingService } from '../../main/services/stocktaking.service';
import { StockService } from '../../main/services/stock.service';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  ERROR_MESSAGES,
  STOCKTAKING_STATUS,
  STOCKTAKING_ITEM_STATUS,
} from '../../shared/constants';

function getTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stocktaking-svc-test-'));
  return path.join(dir, 'test.db');
}

/** 创建测试用的书籍、版本和位置，返回它们的 ID */
function createTestData(options?: { category?: string }) {
  const sqlite = getSqliteDatabase();
  const bookId = uuidv4();
  const editionId = uuidv4();
  const locationId = uuidv4();
  const category = options?.category ?? '测试分类';

  sqlite
    .prepare('INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)')
    .run(bookId, '测试书籍', '测试作者', `ISBN-${bookId.substring(0, 8)}`, category);

  sqlite
    .prepare('INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)')
    .run(editionId, bookId, '精装');

  sqlite
    .prepare('INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)')
    .run(locationId, '仓库A', `书架-${locationId.substring(0, 6)}`, '层1');

  return { bookId, editionId, locationId };
}

describe('StocktakingService', () => {
  let service: StocktakingService;
  let stockService: StockService;

  beforeEach(() => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    service = new StocktakingService();
    stockService = new StockService();
  });

  afterEach(() => {
    closeDatabase();
  });

  // ============================================================
  // create
  // ============================================================

  describe('create', () => {
    it('按位置盘点：应创建盘点任务并加载库存单元', () => {
      const { bookId, editionId, locationId } = createTestData();
      stockService.adjustStock(bookId, editionId, locationId, 10);

      const task = service.create({ scopeType: 'location', scopeValue: locationId });

      expect(task.id).toBeDefined();
      expect(task.scopeType).toBe('location');
      expect(task.scopeValue).toBe(locationId);
      expect(task.status).toBe(STOCKTAKING_STATUS.IN_PROGRESS);
      expect(task.completedAt).toBeNull();

      // 验证盘点项已创建
      const detail = service.getDetail(task.id);
      expect(detail.items).toHaveLength(1);
      expect(detail.items[0].bookId).toBe(bookId);
      expect(detail.items[0].editionId).toBe(editionId);
      expect(detail.items[0].locationId).toBe(locationId);
      expect(detail.items[0].systemQuantity).toBe(10);
      expect(detail.items[0].actualQuantity).toBeNull();
    });

    it('按分类盘点：应加载该分类下所有书籍的库存', () => {
      const category = '科幻小说';
      const data1 = createTestData({ category });
      stockService.adjustStock(data1.bookId, data1.editionId, data1.locationId, 5);

      // 创建另一本同分类的书
      const sqlite = getSqliteDatabase();
      const bookId2 = uuidv4();
      const editionId2 = uuidv4();
      sqlite
        .prepare('INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)')
        .run(bookId2, '另一本书', '另一作者', `ISBN-${bookId2.substring(0, 8)}`, category);
      sqlite
        .prepare('INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)')
        .run(editionId2, bookId2, '平装');
      stockService.adjustStock(bookId2, editionId2, data1.locationId, 8);

      const task = service.create({ scopeType: 'category', scopeValue: category });
      const detail = service.getDetail(task.id);

      expect(detail.items).toHaveLength(2);
    });

    it('盘点范围内无库存单元时应抛出错误', () => {
      const { locationId } = createTestData();
      // 不添加任何库存

      expect(() =>
        service.create({ scopeType: 'location', scopeValue: locationId }),
      ).toThrow(ERROR_MESSAGES.NO_STOCK_IN_SCOPE);
    });

    it('按分类盘点时无匹配分类应抛出错误', () => {
      expect(() =>
        service.create({ scopeType: 'category', scopeValue: '不存在的分类' }),
      ).toThrow(ERROR_MESSAGES.NO_STOCK_IN_SCOPE);
    });
  });

  // ============================================================
  // recordActual
  // ============================================================

  describe('recordActual', () => {
    it('应正确计算差异数量并标记盘盈', () => {
      const { bookId, editionId, locationId } = createTestData();
      stockService.adjustStock(bookId, editionId, locationId, 10);

      const task = service.create({ scopeType: 'location', scopeValue: locationId });
      const detail = service.getDetail(task.id);
      const itemId = detail.items[0].id;

      // 实际数量 15 > 系统数量 10 → 盘盈
      service.recordActual(task.id, [{ itemId, actualQuantity: 15 }]);

      const updated = service.getDetail(task.id);
      expect(updated.items[0].actualQuantity).toBe(15);
      expect(updated.items[0].variance).toBe(5);
      expect(updated.items[0].status).toBe(STOCKTAKING_ITEM_STATUS.SURPLUS);
    });

    it('应正确计算差异数量并标记盘亏', () => {
      const { bookId, editionId, locationId } = createTestData();
      stockService.adjustStock(bookId, editionId, locationId, 10);

      const task = service.create({ scopeType: 'location', scopeValue: locationId });
      const detail = service.getDetail(task.id);
      const itemId = detail.items[0].id;

      // 实际数量 7 < 系统数量 10 → 盘亏
      service.recordActual(task.id, [{ itemId, actualQuantity: 7 }]);

      const updated = service.getDetail(task.id);
      expect(updated.items[0].actualQuantity).toBe(7);
      expect(updated.items[0].variance).toBe(-3);
      expect(updated.items[0].status).toBe(STOCKTAKING_ITEM_STATUS.DEFICIT);
    });

    it('实际数量等于系统数量时应标记一致', () => {
      const { bookId, editionId, locationId } = createTestData();
      stockService.adjustStock(bookId, editionId, locationId, 10);

      const task = service.create({ scopeType: 'location', scopeValue: locationId });
      const detail = service.getDetail(task.id);
      const itemId = detail.items[0].id;

      service.recordActual(task.id, [{ itemId, actualQuantity: 10 }]);

      const updated = service.getDetail(task.id);
      expect(updated.items[0].variance).toBe(0);
      expect(updated.items[0].status).toBe(STOCKTAKING_ITEM_STATUS.MATCH);
    });

    it('应支持批量录入多个盘点项', () => {
      const sqlite = getSqliteDatabase();
      const category = '批量测试';
      const bookId = uuidv4();
      const editionId = uuidv4();
      const loc1 = uuidv4();
      const loc2 = uuidv4();

      sqlite
        .prepare('INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)')
        .run(bookId, '批量书', '作者', `ISBN-${bookId.substring(0, 8)}`, category);
      sqlite
        .prepare('INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)')
        .run(editionId, bookId, '精装');
      sqlite
        .prepare('INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)')
        .run(loc1, '仓库A', `架-${loc1.substring(0, 4)}`, '层1');
      sqlite
        .prepare('INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)')
        .run(loc2, '仓库B', `架-${loc2.substring(0, 4)}`, '层2');

      stockService.adjustStock(bookId, editionId, loc1, 10);
      stockService.adjustStock(bookId, editionId, loc2, 20);

      const task = service.create({ scopeType: 'category', scopeValue: category });
      const detail = service.getDetail(task.id);

      service.recordActual(task.id, [
        { itemId: detail.items[0].id, actualQuantity: 12 },
        { itemId: detail.items[1].id, actualQuantity: 18 },
      ]);

      const updated = service.getDetail(task.id);
      // 所有项都应已录入
      expect(updated.items.every((i) => i.actualQuantity !== null)).toBe(true);
    });
  });

  // ============================================================
  // submit
  // ============================================================

  describe('submit', () => {
    it('应生成正确的盘点报告', () => {
      const sqlite = getSqliteDatabase();
      const category = '报告测试';
      const bookId = uuidv4();
      const editionId = uuidv4();
      const loc1 = uuidv4();
      const loc2 = uuidv4();
      const loc3 = uuidv4();

      sqlite
        .prepare('INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)')
        .run(bookId, '报告书', '作者', `ISBN-${bookId.substring(0, 8)}`, category);
      sqlite
        .prepare('INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)')
        .run(editionId, bookId, '精装');
      sqlite
        .prepare('INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)')
        .run(loc1, '仓库A', `架-${loc1.substring(0, 4)}`, '层1');
      sqlite
        .prepare('INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)')
        .run(loc2, '仓库B', `架-${loc2.substring(0, 4)}`, '层2');
      sqlite
        .prepare('INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)')
        .run(loc3, '仓库C', `架-${loc3.substring(0, 4)}`, '层3');

      stockService.adjustStock(bookId, editionId, loc1, 10);
      stockService.adjustStock(bookId, editionId, loc2, 20);
      stockService.adjustStock(bookId, editionId, loc3, 5);

      const task = service.create({ scopeType: 'category', scopeValue: category });
      const detail = service.getDetail(task.id);

      // 录入两个，留一个未录入
      const item1 = detail.items.find((i) => i.locationId === loc1)!;
      const item2 = detail.items.find((i) => i.locationId === loc2)!;

      service.recordActual(task.id, [
        { itemId: item1.id, actualQuantity: 15 }, // 盘盈
        { itemId: item2.id, actualQuantity: 20 }, // 一致
      ]);

      const report = service.submit(task.id);

      expect(report.taskId).toBe(task.id);
      expect(report.totalItems).toBe(3);
      expect(report.surplusCount).toBe(1);
      expect(report.deficitCount).toBe(0);
      expect(report.matchCount).toBe(1);
      expect(report.unrecordedCount).toBe(1);
      expect(report.items).toHaveLength(3);
    });

    it('所有项都录入时未录入数量应为 0', () => {
      const { bookId, editionId, locationId } = createTestData();
      stockService.adjustStock(bookId, editionId, locationId, 10);

      const task = service.create({ scopeType: 'location', scopeValue: locationId });
      const detail = service.getDetail(task.id);

      service.recordActual(task.id, [
        { itemId: detail.items[0].id, actualQuantity: 10 },
      ]);

      const report = service.submit(task.id);
      expect(report.unrecordedCount).toBe(0);
      expect(report.matchCount).toBe(1);
    });
  });

  // ============================================================
  // confirm
  // ============================================================

  describe('confirm', () => {
    it('应将库存调整为实际数量', () => {
      const { bookId, editionId, locationId } = createTestData();
      stockService.adjustStock(bookId, editionId, locationId, 10);

      const task = service.create({ scopeType: 'location', scopeValue: locationId });
      const detail = service.getDetail(task.id);

      service.recordActual(task.id, [
        { itemId: detail.items[0].id, actualQuantity: 15 },
      ]);

      service.confirm(task.id);

      // 库存应调整为 15
      const qty = stockService.getStockQuantity(bookId, editionId, locationId);
      expect(qty).toBe(15);
    });

    it('应更新任务状态为已完成', () => {
      const { bookId, editionId, locationId } = createTestData();
      stockService.adjustStock(bookId, editionId, locationId, 10);

      const task = service.create({ scopeType: 'location', scopeValue: locationId });
      const detail = service.getDetail(task.id);

      service.recordActual(task.id, [
        { itemId: detail.items[0].id, actualQuantity: 10 },
      ]);

      service.confirm(task.id);

      const updatedDetail = service.getDetail(task.id);
      expect(updatedDetail.task.status).toBe(STOCKTAKING_STATUS.COMPLETED);
      expect(updatedDetail.task.completedAt).not.toBeNull();
    });

    it('应为有差异的库存单元记录操作日志', () => {
      const { bookId, editionId, locationId } = createTestData();
      stockService.adjustStock(bookId, editionId, locationId, 10);

      const task = service.create({ scopeType: 'location', scopeValue: locationId });
      const detail = service.getDetail(task.id);

      service.recordActual(task.id, [
        { itemId: detail.items[0].id, actualQuantity: 15 },
      ]);

      service.confirm(task.id);

      // 检查操作日志
      const sqlite = getSqliteDatabase();
      const logs = sqlite
        .prepare("SELECT * FROM operation_logs WHERE operation_type = 'stocktaking_adjust'")
        .all() as Array<{
          operation_type: string;
          entity_type: string;
          before_data: string;
          after_data: string;
        }>;

      expect(logs).toHaveLength(1);
      expect(logs[0].entity_type).toBe('stock');

      const beforeData = JSON.parse(logs[0].before_data);
      const afterData = JSON.parse(logs[0].after_data);
      expect(beforeData.systemQuantity).toBe(10);
      expect(afterData.actualQuantity).toBe(15);
    });

    it('一致的库存单元不应记录操作日志', () => {
      const { bookId, editionId, locationId } = createTestData();
      stockService.adjustStock(bookId, editionId, locationId, 10);

      const task = service.create({ scopeType: 'location', scopeValue: locationId });
      const detail = service.getDetail(task.id);

      service.recordActual(task.id, [
        { itemId: detail.items[0].id, actualQuantity: 10 },
      ]);

      service.confirm(task.id);

      const sqlite = getSqliteDatabase();
      const logs = sqlite
        .prepare("SELECT * FROM operation_logs WHERE operation_type = 'stocktaking_adjust'")
        .all();

      expect(logs).toHaveLength(0);
    });

    it('未录入实际数量的项应跳过不调整', () => {
      const sqlite = getSqliteDatabase();
      const category = '确认测试';
      const bookId = uuidv4();
      const editionId = uuidv4();
      const loc1 = uuidv4();
      const loc2 = uuidv4();

      sqlite
        .prepare('INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)')
        .run(bookId, '确认书', '作者', `ISBN-${bookId.substring(0, 8)}`, category);
      sqlite
        .prepare('INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)')
        .run(editionId, bookId, '精装');
      sqlite
        .prepare('INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)')
        .run(loc1, '仓库A', `架-${loc1.substring(0, 4)}`, '层1');
      sqlite
        .prepare('INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)')
        .run(loc2, '仓库B', `架-${loc2.substring(0, 4)}`, '层2');

      stockService.adjustStock(bookId, editionId, loc1, 10);
      stockService.adjustStock(bookId, editionId, loc2, 20);

      const task = service.create({ scopeType: 'category', scopeValue: category });
      const detail = service.getDetail(task.id);

      // 只录入 loc1 的实际数量
      const item1 = detail.items.find((i) => i.locationId === loc1)!;
      service.recordActual(task.id, [
        { itemId: item1.id, actualQuantity: 15 },
      ]);

      service.confirm(task.id);

      // loc1 应调整为 15
      expect(stockService.getStockQuantity(bookId, editionId, loc1)).toBe(15);
      // loc2 应保持不变（未录入）
      expect(stockService.getStockQuantity(bookId, editionId, loc2)).toBe(20);
    });
  });

  // ============================================================
  // list
  // ============================================================

  describe('list', () => {
    it('无盘点任务时应返回空列表', () => {
      const tasks = service.list();
      expect(tasks).toHaveLength(0);
    });

    it('应返回所有盘点任务', () => {
      const { bookId, editionId, locationId } = createTestData();
      stockService.adjustStock(bookId, editionId, locationId, 10);

      service.create({ scopeType: 'location', scopeValue: locationId });
      service.create({ scopeType: 'location', scopeValue: locationId });

      const tasks = service.list();
      expect(tasks).toHaveLength(2);
    });
  });

  // ============================================================
  // getDetail
  // ============================================================

  describe('getDetail', () => {
    it('应返回盘点任务详情及关联信息', () => {
      const { bookId, editionId, locationId } = createTestData();
      stockService.adjustStock(bookId, editionId, locationId, 10);

      const task = service.create({ scopeType: 'location', scopeValue: locationId });
      const detail = service.getDetail(task.id);

      expect(detail.task.id).toBe(task.id);
      expect(detail.items).toHaveLength(1);
      expect(detail.items[0].bookTitle).toBe('测试书籍');
      expect(detail.items[0].editionName).toBe('精装');
      expect(detail.items[0].warehouse).toBe('仓库A');
    });

    it('盘点任务不存在时应抛出错误', () => {
      expect(() => service.getDetail('non-existent-id')).toThrow('盘点任务不存在');
    });
  });
});
