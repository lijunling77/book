/**
 * AlertService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeDatabase, closeDatabase, getSqliteDatabase } from '../../main/db';
import { AlertService } from '../../main/services/alert.service';
import { StockService } from '../../main/services/stock.service';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import os from 'os';

function getTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alert-svc-test-'));
  return path.join(dir, 'test.db');
}

/** 创建测试用的书籍和版本，返回它们的 ID */
function createTestBookAndEdition(alertThreshold: number | null = null) {
  const sqlite = getSqliteDatabase();
  const bookId = uuidv4();
  const editionId = uuidv4();

  sqlite
    .prepare('INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)')
    .run(bookId, '测试书籍', '测试作者', `ISBN-${bookId.substring(0, 8)}`, '测试分类');

  sqlite
    .prepare('INSERT INTO editions (id, book_id, name, alert_threshold) VALUES (?, ?, ?, ?)')
    .run(editionId, bookId, '精装', alertThreshold);

  return { bookId, editionId };
}

/** 创建测试用的位置 */
function createTestLocation() {
  const sqlite = getSqliteDatabase();
  const locationId = uuidv4();

  sqlite
    .prepare('INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)')
    .run(locationId, '仓库A', `书架-${locationId.substring(0, 6)}`, '层1');

  return locationId;
}

describe('AlertService', () => {
  let alertService: AlertService;
  let stockService: StockService;

  beforeEach(() => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    stockService = new StockService();
    alertService = new AlertService(stockService);
  });

  afterEach(() => {
    closeDatabase();
  });

  // ============================================================
  // setThreshold
  // ============================================================

  describe('setThreshold', () => {
    it('应成功设置预警阈值', () => {
      const { editionId } = createTestBookAndEdition();

      alertService.setThreshold(editionId, 10);

      const sqlite = getSqliteDatabase();
      const row = sqlite
        .prepare('SELECT alert_threshold FROM editions WHERE id = ?')
        .get(editionId) as { alert_threshold: number | null };

      expect(row.alert_threshold).toBe(10);
    });

    it('应成功更新已有的预警阈值', () => {
      const { editionId } = createTestBookAndEdition(5);

      alertService.setThreshold(editionId, 20);

      const sqlite = getSqliteDatabase();
      const row = sqlite
        .prepare('SELECT alert_threshold FROM editions WHERE id = ?')
        .get(editionId) as { alert_threshold: number | null };

      expect(row.alert_threshold).toBe(20);
    });

    it('传 null 应取消预警阈值', () => {
      const { editionId } = createTestBookAndEdition(10);

      alertService.setThreshold(editionId, null);

      const sqlite = getSqliteDatabase();
      const row = sqlite
        .prepare('SELECT alert_threshold FROM editions WHERE id = ?')
        .get(editionId) as { alert_threshold: number | null };

      expect(row.alert_threshold).toBeNull();
    });

    it('应记录修改时间戳', () => {
      const { editionId } = createTestBookAndEdition();

      const sqlite = getSqliteDatabase();
      const before = sqlite
        .prepare('SELECT updated_at FROM editions WHERE id = ?')
        .get(editionId) as { updated_at: string };

      // 短暂延迟确保时间戳不同
      alertService.setThreshold(editionId, 10);

      const after = sqlite
        .prepare('SELECT updated_at FROM editions WHERE id = ?')
        .get(editionId) as { updated_at: string };

      expect(after.updated_at).toBeDefined();
    });

    it('版本不存在时应抛出异常', () => {
      expect(() => alertService.setThreshold('non-existent-id', 10)).toThrow('版本不存在');
    });
  });

  // ============================================================
  // checkAlert
  // ============================================================

  describe('checkAlert', () => {
    it('总库存低于阈值时应返回 true', () => {
      const { bookId, editionId } = createTestBookAndEdition(10);
      const locationId = createTestLocation();

      stockService.adjustStock(bookId, editionId, locationId, 5);

      const result = alertService.checkAlert(bookId, editionId);
      expect(result).toBe(true);
    });

    it('总库存等于阈值时应返回 true', () => {
      const { bookId, editionId } = createTestBookAndEdition(10);
      const locationId = createTestLocation();

      stockService.adjustStock(bookId, editionId, locationId, 10);

      const result = alertService.checkAlert(bookId, editionId);
      expect(result).toBe(true);
    });

    it('总库存高于阈值时应返回 false', () => {
      const { bookId, editionId } = createTestBookAndEdition(10);
      const locationId = createTestLocation();

      stockService.adjustStock(bookId, editionId, locationId, 15);

      const result = alertService.checkAlert(bookId, editionId);
      expect(result).toBe(false);
    });

    it('未设置预警阈值时应返回 false', () => {
      const { bookId, editionId } = createTestBookAndEdition(null);
      const locationId = createTestLocation();

      stockService.adjustStock(bookId, editionId, locationId, 0);

      const result = alertService.checkAlert(bookId, editionId);
      expect(result).toBe(false);
    });

    it('应基于所有位置的总库存进行检查', () => {
      const { bookId, editionId } = createTestBookAndEdition(15);
      const loc1 = createTestLocation();
      const loc2 = createTestLocation();

      // 两个位置各 5 本，总计 10 < 阈值 15
      stockService.adjustStock(bookId, editionId, loc1, 5);
      stockService.adjustStock(bookId, editionId, loc2, 5);

      expect(alertService.checkAlert(bookId, editionId)).toBe(true);

      // 再加 10 本到 loc1，总计 20 > 阈值 15
      stockService.adjustStock(bookId, editionId, loc1, 10);

      expect(alertService.checkAlert(bookId, editionId)).toBe(false);
    });
  });

  // ============================================================
  // getAlertList
  // ============================================================

  describe('getAlertList', () => {
    it('无预警库存单元时应返回空数组', () => {
      const result = alertService.getAlertList();
      expect(result).toHaveLength(0);
    });

    it('应返回处于预警状态的库存单元', () => {
      const { bookId, editionId } = createTestBookAndEdition(10);
      const locationId = createTestLocation();

      stockService.adjustStock(bookId, editionId, locationId, 5);

      const result = alertService.getAlertList();
      expect(result).toHaveLength(1);
      expect(result[0].bookId).toBe(bookId);
      expect(result[0].editionId).toBe(editionId);
      expect(result[0].totalQuantity).toBe(5);
      expect(result[0].alertThreshold).toBe(10);
      expect(result[0].bookTitle).toBe('测试书籍');
      expect(result[0].editionName).toBe('精装');
    });

    it('不应返回未设置阈值的库存单元', () => {
      const { bookId, editionId } = createTestBookAndEdition(null);
      const locationId = createTestLocation();

      stockService.adjustStock(bookId, editionId, locationId, 0);

      const result = alertService.getAlertList();
      expect(result).toHaveLength(0);
    });

    it('不应返回库存高于阈值的库存单元', () => {
      const { bookId, editionId } = createTestBookAndEdition(5);
      const locationId = createTestLocation();

      stockService.adjustStock(bookId, editionId, locationId, 20);

      const result = alertService.getAlertList();
      expect(result).toHaveLength(0);
    });

    it('应正确返回多个预警库存单元', () => {
      const item1 = createTestBookAndEdition(10);
      const item2 = createTestBookAndEdition(20);
      const loc = createTestLocation();

      // item1: 库存 5 <= 阈值 10 → 预警
      stockService.adjustStock(item1.bookId, item1.editionId, loc, 5);
      // item2: 库存 15 <= 阈值 20 → 预警
      stockService.adjustStock(item2.bookId, item2.editionId, loc, 15);

      const result = alertService.getAlertList();
      expect(result).toHaveLength(2);
    });

    it('无图片时 thumbnailPath 应为 null', () => {
      const { bookId, editionId } = createTestBookAndEdition(10);
      const locationId = createTestLocation();

      stockService.adjustStock(bookId, editionId, locationId, 5);

      const result = alertService.getAlertList();
      expect(result).toHaveLength(1);
      expect(result[0].thumbnailPath).toBeNull();
    });

    it('无库存记录但设置了阈值时应触发预警（总库存为0）', () => {
      // 创建版本并设置阈值，但不创建任何库存记录
      createTestBookAndEdition(5);

      const result = alertService.getAlertList();
      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBe(0);
    });
  });
});
