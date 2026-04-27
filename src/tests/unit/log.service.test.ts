/**
 * LogService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeDatabase, closeDatabase, getDatabase } from '../../main/db';
import { operationLogs } from '../../main/db/schema';
import { LogService } from '../../main/services/log.service';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import os from 'os';

function getTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'log-svc-test-'));
  return path.join(dir, 'test.db');
}

describe('LogService', () => {
  let service: LogService;

  beforeEach(() => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    service = new LogService();
  });

  afterEach(() => {
    closeDatabase();
  });

  // ============================================================
  // create
  // ============================================================

  describe('create', () => {
    it('应成功创建操作日志', () => {
      const log = service.create('create', 'book', 'book-001', null, { title: '测试书籍' });

      expect(log).toBeDefined();
      expect(log.id).toBeDefined();
      expect(log.operationType).toBe('create');
      expect(log.entityType).toBe('book');
      expect(log.entityId).toBe('book-001');
      expect(log.beforeData).toBeNull();
      expect(log.afterData).toBe(JSON.stringify({ title: '测试书籍' }));
      expect(log.createdAt).toBeDefined();
    });

    it('应正确记录编辑操作的变更前后数据', () => {
      const before = { title: '旧标题' };
      const after = { title: '新标题' };
      const log = service.create('edit', 'book', 'book-001', before, after);

      expect(log.operationType).toBe('edit');
      expect(log.beforeData).toBe(JSON.stringify(before));
      expect(log.afterData).toBe(JSON.stringify(after));
    });

    it('应正确记录删除操作（afterData 为 null）', () => {
      const before = { title: '待删除书籍' };
      const log = service.create('delete', 'book', 'book-001', before, null);

      expect(log.operationType).toBe('delete');
      expect(log.beforeData).toBe(JSON.stringify(before));
      expect(log.afterData).toBeNull();
    });

    it('应正确记录盘点调整操作', () => {
      const before = { quantity: 10 };
      const after = { quantity: 8 };
      const log = service.create('stocktaking_adjust', 'stock', 'stock-001', before, after);

      expect(log.operationType).toBe('stocktaking_adjust');
      expect(log.entityType).toBe('stock');
    });

    it('应支持所有操作对象类型', () => {
      const entityTypes = [
        'book', 'edition', 'location', 'inbound_record',
        'outbound_record', 'stock', 'stocktaking_task', 'backup',
      ] as const;

      for (const entityType of entityTypes) {
        const log = service.create('create', entityType, `${entityType}-001`, null, { test: true });
        expect(log.entityType).toBe(entityType);
      }
    });
  });

  // ============================================================
  // list
  // ============================================================

  describe('list', () => {
    it('应返回分页结果', () => {
      // 创建 5 条日志
      for (let i = 1; i <= 5; i++) {
        service.create('create', 'book', `book-${i}`, null, { title: `书籍${i}` });
      }

      const result = service.list({ page: 1, pageSize: 3 });
      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(3);
    });

    it('应按操作时间倒序排列', () => {
      // 使用不同的 createdAt 时间来确保排序可验证
      const db = getDatabase();

      db.insert(operationLogs).values({
        id: uuidv4(),
        operationType: 'create',
        entityType: 'book',
        entityId: 'book-1',
        beforeData: null,
        afterData: JSON.stringify({ title: '第一条' }),
        createdAt: '2024-01-01 10:00:00',
      }).run();

      db.insert(operationLogs).values({
        id: uuidv4(),
        operationType: 'edit',
        entityType: 'book',
        entityId: 'book-2',
        beforeData: JSON.stringify({ title: '旧' }),
        afterData: JSON.stringify({ title: '新' }),
        createdAt: '2024-01-02 10:00:00',
      }).run();

      db.insert(operationLogs).values({
        id: uuidv4(),
        operationType: 'delete',
        entityType: 'book',
        entityId: 'book-3',
        beforeData: JSON.stringify({ title: '删除' }),
        afterData: null,
        createdAt: '2024-01-03 10:00:00',
      }).run();

      const result = service.list();
      // 最新的记录应该在最前面
      expect(result.data.length).toBe(3);
      expect(result.data[0].operationType).toBe('delete');
      expect(result.data[0].createdAt).toBe('2024-01-03 10:00:00');
      expect(result.data[1].operationType).toBe('edit');
      expect(result.data[2].operationType).toBe('create');
      expect(result.data[2].createdAt).toBe('2024-01-01 10:00:00');
    });

    it('应支持按操作类型筛选', () => {
      service.create('create', 'book', 'book-1', null, { title: '创建' });
      service.create('edit', 'book', 'book-2', {}, { title: '编辑' });
      service.create('delete', 'book', 'book-3', { title: '删除' }, null);

      const result = service.list({ operationType: 'edit' });
      expect(result.total).toBe(1);
      expect(result.data[0].operationType).toBe('edit');
    });

    it('应支持按操作对象类型筛选', () => {
      service.create('create', 'book', 'book-1', null, { title: '书籍' });
      service.create('create', 'edition', 'edition-1', null, { name: '版本' });
      service.create('create', 'location', 'loc-1', null, { warehouse: '仓库' });

      const result = service.list({ entityType: 'book' });
      expect(result.total).toBe(1);
      expect(result.data[0].entityType).toBe('book');
    });

    it('应支持按操作对象标识筛选', () => {
      service.create('create', 'book', 'book-target', null, { title: '目标' });
      service.create('edit', 'book', 'book-target', { title: '旧' }, { title: '新' });
      service.create('create', 'book', 'book-other', null, { title: '其他' });

      const result = service.list({ entityId: 'book-target' });
      expect(result.total).toBe(2);
      result.data.forEach((log) => {
        expect(log.entityId).toBe('book-target');
      });
    });

    it('应支持按日期范围筛选', () => {
      service.create('create', 'book', 'book-1', null, { title: '书籍1' });

      // 使用当前日期作为范围
      const today = new Date().toISOString().substring(0, 10);
      const result = service.list({
        dateRange: { startDate: today, endDate: today },
      });
      expect(result.total).toBeGreaterThanOrEqual(1);
    });

    it('无数据时应返回空列表', () => {
      const result = service.list();
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('不传筛选参数时应使用默认分页', () => {
      service.create('create', 'book', 'book-1', null, { title: '默认分页' });

      const result = service.list();
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('应支持组合筛选条件', () => {
      service.create('create', 'book', 'book-1', null, { title: '创建书籍' });
      service.create('edit', 'book', 'book-1', {}, { title: '编辑书籍' });
      service.create('create', 'edition', 'edition-1', null, { name: '创建版本' });
      service.create('delete', 'book', 'book-2', { title: '删除' }, null);

      const result = service.list({
        operationType: 'create',
        entityType: 'book',
      });
      expect(result.total).toBe(1);
      expect(result.data[0].entityId).toBe('book-1');
    });
  });
});
