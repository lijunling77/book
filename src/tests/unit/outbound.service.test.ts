/**
 * OutboundService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeDatabase, closeDatabase, getSqliteDatabase } from '../../main/db';
import { OutboundService } from '../../main/services/outbound.service';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { ERROR_MESSAGES } from '../../shared/constants';

function getTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'outbound-svc-test-'));
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

/** 为指定库存单元添加库存（通过直接插入 stock 表） */
function addStock(bookId: string, editionId: string, locationId: string, quantity: number) {
  const sqlite = getSqliteDatabase();
  sqlite
    .prepare('INSERT INTO stock (id, book_id, edition_id, location_id, quantity) VALUES (?, ?, ?, ?, ?)')
    .run(uuidv4(), bookId, editionId, locationId, quantity);
}

describe('OutboundService', () => {
  let service: OutboundService;

  beforeEach(() => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    service = new OutboundService();
  });

  afterEach(() => {
    closeDatabase();
  });

  // ============================================================
  // create
  // ============================================================

  describe('create', () => {
    it('库存充足时应成功创建出库记录并减少库存', () => {
      const { bookId, editionId, locationId } = createTestData();
      addStock(bookId, editionId, locationId, 10);

      const record = service.create({
        bookId,
        editionId,
        locationId,
        outboundDate: '2024-03-01',
        quantity: 3,
        sellingPrice: 50.0,
        buyer: '买家A',
      });

      expect(record.id).toBeDefined();
      expect(record.bookId).toBe(bookId);
      expect(record.editionId).toBe(editionId);
      expect(record.locationId).toBe(locationId);
      expect(record.quantity).toBe(3);
      expect(record.sellingPrice).toBe(50.0);
      expect(record.buyer).toBe('买家A');

      // 验证库存减少
      const sqlite = getSqliteDatabase();
      const stock = sqlite
        .prepare('SELECT quantity FROM stock WHERE book_id = ? AND edition_id = ? AND location_id = ?')
        .get(bookId, editionId, locationId) as { quantity: number };
      expect(stock.quantity).toBe(7);
    });

    it('库存不足时应拒绝出库并显示当前可用库存数量', () => {
      const { bookId, editionId, locationId } = createTestData();
      addStock(bookId, editionId, locationId, 5);

      expect(() =>
        service.create({
          bookId,
          editionId,
          locationId,
          outboundDate: '2024-03-01',
          quantity: 10,
          sellingPrice: 50.0,
        }),
      ).toThrow(/库存不足.*当前可用库存数量：5/);
    });

    it('库存为零时应拒绝出库', () => {
      const { bookId, editionId, locationId } = createTestData();
      // 不添加库存，默认为 0

      expect(() =>
        service.create({
          bookId,
          editionId,
          locationId,
          outboundDate: '2024-03-01',
          quantity: 1,
          sellingPrice: 50.0,
        }),
      ).toThrow(/库存不足.*当前可用库存数量：0/);
    });

    it('书籍不存在时应拒绝出库', () => {
      const { editionId, locationId } = createTestData();

      expect(() =>
        service.create({
          bookId: uuidv4(),
          editionId,
          locationId,
          outboundDate: '2024-03-01',
          quantity: 1,
          sellingPrice: 50.0,
        }),
      ).toThrow(ERROR_MESSAGES.BOOK_NOT_FOUND);
    });

    it('版本不存在时应拒绝出库', () => {
      const { bookId, locationId } = createTestData();

      expect(() =>
        service.create({
          bookId,
          editionId: uuidv4(),
          locationId,
          outboundDate: '2024-03-01',
          quantity: 1,
          sellingPrice: 50.0,
        }),
      ).toThrow(ERROR_MESSAGES.EDITION_NOT_FOUND);
    });

    it('位置不存在时应拒绝出库', () => {
      const { bookId, editionId } = createTestData();

      expect(() =>
        service.create({
          bookId,
          editionId,
          locationId: uuidv4(),
          outboundDate: '2024-03-01',
          quantity: 1,
          sellingPrice: 50.0,
        }),
      ).toThrow(ERROR_MESSAGES.LOCATION_NOT_FOUND);
    });

    it('应自动记录操作日志', () => {
      const { bookId, editionId, locationId } = createTestData();
      addStock(bookId, editionId, locationId, 10);

      const record = service.create({
        bookId,
        editionId,
        locationId,
        outboundDate: '2024-03-01',
        quantity: 2,
        sellingPrice: 30.0,
      });

      const sqlite = getSqliteDatabase();
      const log = sqlite
        .prepare('SELECT * FROM operation_logs WHERE entity_id = ? AND entity_type = ?')
        .get(record.id, 'outbound_record') as { operation_type: string; after_data: string };
      expect(log).toBeDefined();
      expect(log.operation_type).toBe('create');
      expect(log.after_data).toBeDefined();
    });

    it('出库全部库存应成功（库存降为零）', () => {
      const { bookId, editionId, locationId } = createTestData();
      addStock(bookId, editionId, locationId, 5);

      const record = service.create({
        bookId,
        editionId,
        locationId,
        outboundDate: '2024-03-01',
        quantity: 5,
        sellingPrice: 50.0,
      });

      expect(record.quantity).toBe(5);

      const sqlite = getSqliteDatabase();
      const stock = sqlite
        .prepare('SELECT quantity FROM stock WHERE book_id = ? AND edition_id = ? AND location_id = ?')
        .get(bookId, editionId, locationId) as { quantity: number };
      expect(stock.quantity).toBe(0);
    });
  });

  // ============================================================
  // update
  // ============================================================

  describe('update', () => {
    it('应正确更新出库记录的基本字段', () => {
      const { bookId, editionId, locationId } = createTestData();
      addStock(bookId, editionId, locationId, 10);

      const record = service.create({
        bookId,
        editionId,
        locationId,
        outboundDate: '2024-03-01',
        quantity: 3,
        sellingPrice: 50.0,
        buyer: '买家A',
      });

      const updated = service.update(record.id, {
        outboundDate: '2024-03-15',
        sellingPrice: 60.0,
        buyer: '买家B',
      });

      expect(updated.outboundDate).toBe('2024-03-15');
      expect(updated.sellingPrice).toBe(60.0);
      expect(updated.buyer).toBe('买家B');
    });

    it('数量减少时应增加库存', () => {
      const { bookId, editionId, locationId } = createTestData();
      addStock(bookId, editionId, locationId, 10);

      const record = service.create({
        bookId,
        editionId,
        locationId,
        outboundDate: '2024-03-01',
        quantity: 5,
        sellingPrice: 50.0,
      });
      // 库存现在是 5

      service.update(record.id, { quantity: 3 });
      // 出库数量从 5 减到 3，库存应增加 2

      const sqlite = getSqliteDatabase();
      const stock = sqlite
        .prepare('SELECT quantity FROM stock WHERE book_id = ? AND edition_id = ? AND location_id = ?')
        .get(bookId, editionId, locationId) as { quantity: number };
      expect(stock.quantity).toBe(7);
    });

    it('数量增加时应减少库存', () => {
      const { bookId, editionId, locationId } = createTestData();
      addStock(bookId, editionId, locationId, 10);

      const record = service.create({
        bookId,
        editionId,
        locationId,
        outboundDate: '2024-03-01',
        quantity: 3,
        sellingPrice: 50.0,
      });
      // 库存现在是 7

      service.update(record.id, { quantity: 5 });
      // 出库数量从 3 增到 5，库存应减少 2

      const sqlite = getSqliteDatabase();
      const stock = sqlite
        .prepare('SELECT quantity FROM stock WHERE book_id = ? AND edition_id = ? AND location_id = ?')
        .get(bookId, editionId, locationId) as { quantity: number };
      expect(stock.quantity).toBe(5);
    });

    it('数量增加导致库存为负时应拒绝', () => {
      const { bookId, editionId, locationId } = createTestData();
      addStock(bookId, editionId, locationId, 10);

      const record = service.create({
        bookId,
        editionId,
        locationId,
        outboundDate: '2024-03-01',
        quantity: 8,
        sellingPrice: 50.0,
      });
      // 库存现在是 2

      expect(() => service.update(record.id, { quantity: 15 })).toThrow();
    });

    it('位置变更时应正确调整库存', () => {
      const { bookId, editionId, locationId } = createTestData();
      addStock(bookId, editionId, locationId, 10);

      // 创建第二个位置并添加库存
      const sqlite = getSqliteDatabase();
      const locationId2 = uuidv4();
      sqlite
        .prepare('INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)')
        .run(locationId2, '仓库B', `书架-${locationId2.substring(0, 6)}`, '层2');
      addStock(bookId, editionId, locationId2, 20);

      const record = service.create({
        bookId,
        editionId,
        locationId,
        outboundDate: '2024-03-01',
        quantity: 3,
        sellingPrice: 50.0,
      });
      // 位置1库存: 7, 位置2库存: 20

      service.update(record.id, { locationId: locationId2 });
      // 位置1应回退: 7 + 3 = 10, 位置2应减少: 20 - 3 = 17

      const stock1 = sqlite
        .prepare('SELECT quantity FROM stock WHERE book_id = ? AND edition_id = ? AND location_id = ?')
        .get(bookId, editionId, locationId) as { quantity: number };
      const stock2 = sqlite
        .prepare('SELECT quantity FROM stock WHERE book_id = ? AND edition_id = ? AND location_id = ?')
        .get(bookId, editionId, locationId2) as { quantity: number };

      expect(stock1.quantity).toBe(10);
      expect(stock2.quantity).toBe(17);
    });

    it('出库记录不存在时应抛出异常', () => {
      expect(() => service.update(uuidv4(), { quantity: 5 })).toThrow('出库记录不存在');
    });

    it('应记录操作日志', () => {
      const { bookId, editionId, locationId } = createTestData();
      addStock(bookId, editionId, locationId, 10);

      const record = service.create({
        bookId,
        editionId,
        locationId,
        outboundDate: '2024-03-01',
        quantity: 3,
        sellingPrice: 50.0,
      });

      service.update(record.id, { sellingPrice: 60.0 });

      const sqlite = getSqliteDatabase();
      const logs = sqlite
        .prepare('SELECT * FROM operation_logs WHERE entity_id = ? AND operation_type = ?')
        .all(record.id, 'edit') as { before_data: string; after_data: string }[];
      expect(logs).toHaveLength(1);
      expect(logs[0].before_data).toBeDefined();
      expect(logs[0].after_data).toBeDefined();
    });
  });

  // ============================================================
  // delete
  // ============================================================

  describe('delete', () => {
    it('应成功删除出库记录并增加库存', () => {
      const { bookId, editionId, locationId } = createTestData();
      addStock(bookId, editionId, locationId, 10);

      const record = service.create({
        bookId,
        editionId,
        locationId,
        outboundDate: '2024-03-01',
        quantity: 3,
        sellingPrice: 50.0,
      });
      // 库存现在是 7

      const result = service.delete(record.id);

      // 验证返回的预览信息
      expect(result.record.id).toBe(record.id);
      expect(result.stockChange.currentQuantity).toBe(7);
      expect(result.stockChange.changeQuantity).toBe(3);

      // 验证库存已回退
      const sqlite = getSqliteDatabase();
      const stock = sqlite
        .prepare('SELECT quantity FROM stock WHERE book_id = ? AND edition_id = ? AND location_id = ?')
        .get(bookId, editionId, locationId) as { quantity: number };
      expect(stock.quantity).toBe(10);

      // 验证记录已删除
      const deleted = sqlite
        .prepare('SELECT * FROM outbound_records WHERE id = ?')
        .get(record.id);
      expect(deleted).toBeUndefined();
    });

    it('出库记录不存在时应抛出异常', () => {
      expect(() => service.delete(uuidv4())).toThrow('出库记录不存在');
    });

    it('应记录删除操作日志', () => {
      const { bookId, editionId, locationId } = createTestData();
      addStock(bookId, editionId, locationId, 10);

      const record = service.create({
        bookId,
        editionId,
        locationId,
        outboundDate: '2024-03-01',
        quantity: 2,
        sellingPrice: 30.0,
      });

      service.delete(record.id);

      const sqlite = getSqliteDatabase();
      const logs = sqlite
        .prepare('SELECT * FROM operation_logs WHERE entity_id = ? AND operation_type = ?')
        .all(record.id, 'delete') as { before_data: string; after_data: string | null }[];
      expect(logs).toHaveLength(1);
      expect(logs[0].before_data).toBeDefined();
      expect(logs[0].after_data).toBeNull();
    });
  });

  // ============================================================
  // list
  // ============================================================

  describe('list', () => {
    it('无出库记录时应返回空列表', () => {
      const result = service.list();
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('应返回出库记录列表并包含关联信息', () => {
      const { bookId, editionId, locationId } = createTestData();
      addStock(bookId, editionId, locationId, 10);

      service.create({
        bookId,
        editionId,
        locationId,
        outboundDate: '2024-03-01',
        quantity: 2,
        sellingPrice: 50.0,
        buyer: '买家A',
      });

      const result = service.list();
      expect(result.data).toHaveLength(1);

      const item = result.data[0];
      expect(item.bookTitle).toBe('测试书籍');
      expect(item.editionName).toBe('精装');
      expect(item.warehouse).toBe('仓库A');
      expect(item.buyer).toBe('买家A');
    });

    it('应支持按书籍标识筛选', () => {
      const data1 = createTestData();
      addStock(data1.bookId, data1.editionId, data1.locationId, 10);
      service.create({
        bookId: data1.bookId,
        editionId: data1.editionId,
        locationId: data1.locationId,
        outboundDate: '2024-03-01',
        quantity: 1,
        sellingPrice: 50.0,
      });

      const data2 = createTestData();
      addStock(data2.bookId, data2.editionId, data2.locationId, 10);
      service.create({
        bookId: data2.bookId,
        editionId: data2.editionId,
        locationId: data2.locationId,
        outboundDate: '2024-03-01',
        quantity: 1,
        sellingPrice: 50.0,
      });

      const result = service.list({ bookId: data1.bookId });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].bookId).toBe(data1.bookId);
    });

    it('应支持按日期范围筛选', () => {
      const { bookId, editionId, locationId } = createTestData();
      addStock(bookId, editionId, locationId, 20);

      service.create({
        bookId,
        editionId,
        locationId,
        outboundDate: '2024-01-15',
        quantity: 1,
        sellingPrice: 50.0,
      });
      service.create({
        bookId,
        editionId,
        locationId,
        outboundDate: '2024-03-15',
        quantity: 1,
        sellingPrice: 50.0,
      });

      const result = service.list({
        dateRange: { startDate: '2024-03-01', endDate: '2024-03-31' },
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].outboundDate).toBe('2024-03-15');
    });

    it('应支持分页', () => {
      const { bookId, editionId, locationId } = createTestData();
      addStock(bookId, editionId, locationId, 20);

      for (let i = 0; i < 3; i++) {
        service.create({
          bookId,
          editionId,
          locationId,
          outboundDate: `2024-03-0${i + 1}`,
          quantity: 1,
          sellingPrice: 50.0,
        });
      }

      const page1 = service.list({ page: 1, pageSize: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page1.total).toBe(3);

      const page2 = service.list({ page: 2, pageSize: 2 });
      expect(page2.data).toHaveLength(1);
    });
  });

  // ============================================================
  // batchCreate
  // ============================================================

  describe('batchCreate', () => {
    it('全部成功时应返回正确的摘要', () => {
      const { bookId, editionId, locationId } = createTestData();
      addStock(bookId, editionId, locationId, 20);

      const result = service.batchCreate([
        {
          bookId,
          editionId,
          locationId,
          outboundDate: '2024-03-01',
          quantity: 3,
          sellingPrice: 50.0,
        },
        {
          bookId,
          editionId,
          locationId,
          outboundDate: '2024-03-02',
          quantity: 2,
          sellingPrice: 60.0,
        },
      ]);

      expect(result.totalCount).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.failures).toHaveLength(0);
    });

    it('部分失败时应跳过失败记录继续处理', () => {
      const { bookId, editionId, locationId } = createTestData();
      addStock(bookId, editionId, locationId, 5);

      const result = service.batchCreate([
        {
          bookId,
          editionId,
          locationId,
          outboundDate: '2024-03-01',
          quantity: 3,
          sellingPrice: 50.0,
        },
        {
          bookId,
          editionId,
          locationId,
          outboundDate: '2024-03-02',
          quantity: 10, // 库存不足，应失败
          sellingPrice: 60.0,
        },
      ]);

      expect(result.totalCount).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].index).toBe(1);
      expect(result.failures[0].reason).toContain('库存不足');
    });

    it('全部失败时应返回所有失败原因', () => {
      const result = service.batchCreate([
        {
          bookId: uuidv4(),
          editionId: uuidv4(),
          locationId: uuidv4(),
          outboundDate: '2024-03-01',
          quantity: 1,
          sellingPrice: 50.0,
        },
        {
          bookId: uuidv4(),
          editionId: uuidv4(),
          locationId: uuidv4(),
          outboundDate: '2024-03-02',
          quantity: 1,
          sellingPrice: 60.0,
        },
      ]);

      expect(result.totalCount).toBe(2);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(2);
      expect(result.failures).toHaveLength(2);
    });
  });
});
