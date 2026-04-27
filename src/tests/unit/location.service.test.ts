/**
 * LocationService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeDatabase, closeDatabase, getSqliteDatabase } from '../../main/db';
import { LocationService } from '../../main/services/location.service';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { ERROR_MESSAGES } from '../../shared/constants';

function getTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'location-svc-test-'));
  return path.join(dir, 'test.db');
}

describe('LocationService', () => {
  let service: LocationService;

  beforeEach(() => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    service = new LocationService();
  });

  afterEach(() => {
    closeDatabase();
  });

  // ============================================================
  // create
  // ============================================================

  describe('create', () => {
    it('应成功创建位置', () => {
      const location = service.create({
        warehouse: '仓库A',
        shelf: '书架1',
        layer: '层1',
      });

      expect(location).toBeDefined();
      expect(location.id).toBeDefined();
      expect(location.warehouse).toBe('仓库A');
      expect(location.shelf).toBe('书架1');
      expect(location.layer).toBe('层1');
      expect(location.createdAt).toBeDefined();
      expect(location.updatedAt).toBeDefined();
    });

    it('仓库+书架+层号组合重复时应抛出错误', () => {
      service.create({
        warehouse: '仓库A',
        shelf: '书架1',
        layer: '层1',
      });

      expect(() =>
        service.create({
          warehouse: '仓库A',
          shelf: '书架1',
          layer: '层1',
        }),
      ).toThrow(ERROR_MESSAGES.LOCATION_ALREADY_EXISTS);
    });

    it('不同仓库下相同书架和层号应允许创建', () => {
      service.create({
        warehouse: '仓库A',
        shelf: '书架1',
        layer: '层1',
      });

      const location2 = service.create({
        warehouse: '仓库B',
        shelf: '书架1',
        layer: '层1',
      });

      expect(location2).toBeDefined();
      expect(location2.warehouse).toBe('仓库B');
    });

    it('应记录创建操作日志', () => {
      const location = service.create({
        warehouse: '仓库A',
        shelf: '书架1',
        layer: '层1',
      });

      const sqlite = getSqliteDatabase();
      const logs = sqlite
        .prepare('SELECT * FROM operation_logs WHERE entity_id = ? AND operation_type = ?')
        .all(location.id, 'create') as Array<{ entity_type: string; after_data: string }>;

      expect(logs).toHaveLength(1);
      expect(logs[0].entity_type).toBe('location');
      expect(logs[0].after_data).toBeDefined();
    });
  });

  // ============================================================
  // update
  // ============================================================

  describe('update', () => {
    it('应成功更新位置信息', () => {
      const location = service.create({
        warehouse: '仓库A',
        shelf: '书架1',
        layer: '层1',
      });

      const updated = service.update(location.id, {
        warehouse: '仓库B',
      });

      expect(updated.warehouse).toBe('仓库B');
      expect(updated.shelf).toBe('书架1');
      expect(updated.layer).toBe('层1');
    });

    it('应更新修改时间戳', () => {
      const location = service.create({
        warehouse: '仓库A',
        shelf: '书架1',
        layer: '层1',
      });

      const updated = service.update(location.id, { shelf: '书架2' });
      expect(updated.updatedAt).toBeDefined();
    });

    it('更新后组合与已有位置重复时应抛出错误', () => {
      service.create({
        warehouse: '仓库A',
        shelf: '书架1',
        layer: '层1',
      });

      const location2 = service.create({
        warehouse: '仓库A',
        shelf: '书架2',
        layer: '层1',
      });

      expect(() =>
        service.update(location2.id, { shelf: '书架1' }),
      ).toThrow(ERROR_MESSAGES.LOCATION_ALREADY_EXISTS);
    });

    it('位置不存在时应抛出错误', () => {
      expect(() =>
        service.update('non-existent-id', { warehouse: '仓库B' }),
      ).toThrow(ERROR_MESSAGES.LOCATION_NOT_FOUND);
    });

    it('应记录编辑操作日志', () => {
      const location = service.create({
        warehouse: '仓库A',
        shelf: '书架1',
        layer: '层1',
      });

      service.update(location.id, { warehouse: '仓库B' });

      const sqlite = getSqliteDatabase();
      const logs = sqlite
        .prepare('SELECT * FROM operation_logs WHERE entity_id = ? AND operation_type = ?')
        .all(location.id, 'edit') as Array<{ before_data: string; after_data: string }>;

      expect(logs).toHaveLength(1);
      expect(logs[0].before_data).toBeDefined();
      expect(logs[0].after_data).toBeDefined();
    });
  });

  // ============================================================
  // delete
  // ============================================================

  describe('delete', () => {
    it('应成功删除无库存的位置', () => {
      const location = service.create({
        warehouse: '仓库A',
        shelf: '书架1',
        layer: '层1',
      });

      service.delete(location.id);

      const allLocations = service.list();
      expect(allLocations).toHaveLength(0);
    });

    it('位置不存在时应抛出错误', () => {
      expect(() => service.delete('non-existent-id')).toThrow(
        ERROR_MESSAGES.LOCATION_NOT_FOUND,
      );
    });

    it('有库存 > 0 时应拒绝删除', () => {
      const location = service.create({
        warehouse: '仓库A',
        shelf: '书架1',
        layer: '层1',
      });

      const sqlite = getSqliteDatabase();
      const bookId = uuidv4();
      const editionId = uuidv4();

      // 创建书籍
      sqlite
        .prepare('INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)')
        .run(bookId, '测试书籍', '作者', 'ISBN-LOC-001', '分类');

      // 创建版本
      sqlite
        .prepare('INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)')
        .run(editionId, bookId, '精装');

      // 创建库存记录（数量 > 0）
      sqlite
        .prepare(
          'INSERT INTO stock (id, book_id, edition_id, location_id, quantity) VALUES (?, ?, ?, ?, ?)',
        )
        .run(uuidv4(), bookId, editionId, location.id, 5);

      expect(() => service.delete(location.id)).toThrow(ERROR_MESSAGES.LOCATION_HAS_STOCK);
    });

    it('有库存 > 0 时应返回库存列表', () => {
      const location = service.create({
        warehouse: '仓库A',
        shelf: '书架1',
        layer: '层1',
      });

      const sqlite = getSqliteDatabase();
      const bookId = uuidv4();
      const editionId = uuidv4();

      sqlite
        .prepare('INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)')
        .run(bookId, '测试书籍', '作者', 'ISBN-LOC-002', '分类');
      sqlite
        .prepare('INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)')
        .run(editionId, bookId, '精装');
      sqlite
        .prepare(
          'INSERT INTO stock (id, book_id, edition_id, location_id, quantity) VALUES (?, ?, ?, ?, ?)',
        )
        .run(uuidv4(), bookId, editionId, location.id, 3);

      try {
        service.delete(location.id);
      } catch (error) {
        const err = error as Error & { stockList?: unknown[] };
        expect(err.stockList).toBeDefined();
        expect(err.stockList!.length).toBeGreaterThan(0);
      }
    });

    it('所有库存为 0 时应允许删除', () => {
      const location = service.create({
        warehouse: '仓库A',
        shelf: '书架1',
        layer: '层1',
      });

      const sqlite = getSqliteDatabase();
      const bookId = uuidv4();
      const editionId = uuidv4();

      sqlite
        .prepare('INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)')
        .run(bookId, '测试书籍', '作者', 'ISBN-LOC-003', '分类');
      sqlite
        .prepare('INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)')
        .run(editionId, bookId, '精装');
      sqlite
        .prepare(
          'INSERT INTO stock (id, book_id, edition_id, location_id, quantity) VALUES (?, ?, ?, ?, ?)',
        )
        .run(uuidv4(), bookId, editionId, location.id, 0);

      expect(() => service.delete(location.id)).not.toThrow();
    });

    it('应记录删除操作日志', () => {
      const location = service.create({
        warehouse: '仓库A',
        shelf: '书架1',
        layer: '层1',
      });

      service.delete(location.id);

      const sqlite = getSqliteDatabase();
      const logs = sqlite
        .prepare('SELECT * FROM operation_logs WHERE entity_id = ? AND operation_type = ?')
        .all(location.id, 'delete') as Array<{ before_data: string; after_data: string | null }>;

      expect(logs).toHaveLength(1);
      expect(logs[0].before_data).toBeDefined();
      expect(logs[0].after_data).toBeNull();
    });
  });

  // ============================================================
  // list
  // ============================================================

  describe('list', () => {
    it('应返回所有位置', () => {
      service.create({ warehouse: '仓库A', shelf: '书架1', layer: '层1' });
      service.create({ warehouse: '仓库A', shelf: '书架1', layer: '层2' });
      service.create({ warehouse: '仓库B', shelf: '书架1', layer: '层1' });

      const result = service.list();
      expect(result).toHaveLength(3);
    });

    it('无数据时应返回空数组', () => {
      const result = service.list();
      expect(result).toHaveLength(0);
    });
  });

  // ============================================================
  // getStock
  // ============================================================

  describe('getStock', () => {
    it('应返回指定位置的所有库存单元及数量', () => {
      const location = service.create({
        warehouse: '仓库A',
        shelf: '书架1',
        layer: '层1',
      });

      const sqlite = getSqliteDatabase();
      const bookId1 = uuidv4();
      const editionId1 = uuidv4();
      const bookId2 = uuidv4();
      const editionId2 = uuidv4();

      // 创建两本书和版本
      sqlite
        .prepare('INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)')
        .run(bookId1, '书籍A', '作者A', 'ISBN-GS-001', '分类A');
      sqlite
        .prepare('INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)')
        .run(editionId1, bookId1, '精装');

      sqlite
        .prepare('INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)')
        .run(bookId2, '书籍B', '作者B', 'ISBN-GS-002', '分类B');
      sqlite
        .prepare('INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)')
        .run(editionId2, bookId2, '平装');

      // 创建库存记录
      sqlite
        .prepare(
          'INSERT INTO stock (id, book_id, edition_id, location_id, quantity) VALUES (?, ?, ?, ?, ?)',
        )
        .run(uuidv4(), bookId1, editionId1, location.id, 10);
      sqlite
        .prepare(
          'INSERT INTO stock (id, book_id, edition_id, location_id, quantity) VALUES (?, ?, ?, ?, ?)',
        )
        .run(uuidv4(), bookId2, editionId2, location.id, 5);

      const stockItems = service.getStock(location.id);

      expect(stockItems).toHaveLength(2);

      const item1 = stockItems.find((s) => s.bookId === bookId1);
      expect(item1).toBeDefined();
      expect(item1!.bookTitle).toBe('书籍A');
      expect(item1!.editionName).toBe('精装');
      expect(item1!.quantity).toBe(10);

      const item2 = stockItems.find((s) => s.bookId === bookId2);
      expect(item2).toBeDefined();
      expect(item2!.bookTitle).toBe('书籍B');
      expect(item2!.editionName).toBe('平装');
      expect(item2!.quantity).toBe(5);
    });

    it('位置不存在时应抛出错误', () => {
      expect(() => service.getStock('non-existent-id')).toThrow(
        ERROR_MESSAGES.LOCATION_NOT_FOUND,
      );
    });

    it('位置下无库存时应返回空数组', () => {
      const location = service.create({
        warehouse: '仓库A',
        shelf: '书架1',
        layer: '层1',
      });

      const stockItems = service.getStock(location.id);
      expect(stockItems).toHaveLength(0);
    });
  });
});
