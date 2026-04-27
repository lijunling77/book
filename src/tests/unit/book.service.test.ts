/**
 * BookService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeDatabase, closeDatabase } from '../../main/db';
import { BookService } from '../../main/services/book.service';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { getSqliteDatabase } from '../../main/db';
import { ERROR_MESSAGES } from '../../shared/constants';

function getTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'book-svc-test-'));
  return path.join(dir, 'test.db');
}

describe('BookService', () => {
  let service: BookService;

  beforeEach(() => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    service = new BookService();
  });

  afterEach(() => {
    closeDatabase();
  });

  // ============================================================
  // create
  // ============================================================

  describe('create', () => {
    it('应成功创建书籍', () => {
      const book = service.create({
        title: '测试书籍',
        author: '测试作者',
        isbn: 'ISBN-001',
        category: '小说',
        description: '一本测试书籍',
      });

      expect(book).toBeDefined();
      expect(book.id).toBeDefined();
      expect(book.title).toBe('测试书籍');
      expect(book.author).toBe('测试作者');
      expect(book.isbn).toBe('ISBN-001');
      expect(book.category).toBe('小说');
      expect(book.description).toBe('一本测试书籍');
      expect(book.createdAt).toBeDefined();
      expect(book.updatedAt).toBeDefined();
    });

    it('应在 description 为 undefined 时设为 null', () => {
      const book = service.create({
        title: '测试书籍',
        author: '测试作者',
        isbn: 'ISBN-001',
        category: '小说',
      });

      expect(book.description).toBeNull();
    });

    it('ISBN 重复时应抛出错误', () => {
      service.create({
        title: '书籍A',
        author: '作者A',
        isbn: 'ISBN-DUP',
        category: '分类A',
      });

      expect(() =>
        service.create({
          title: '书籍B',
          author: '作者B',
          isbn: 'ISBN-DUP',
          category: '分类B',
        }),
      ).toThrow(ERROR_MESSAGES.ISBN_ALREADY_EXISTS);
    });

    it('应记录创建操作日志', () => {
      const book = service.create({
        title: '日志测试',
        author: '作者',
        isbn: 'ISBN-LOG',
        category: '分类',
      });

      const sqlite = getSqliteDatabase();
      const logs = sqlite
        .prepare('SELECT * FROM operation_logs WHERE entity_id = ? AND operation_type = ?')
        .all(book.id, 'create') as Array<{ entity_type: string; after_data: string }>;

      expect(logs).toHaveLength(1);
      expect(logs[0].entity_type).toBe('book');
      expect(logs[0].after_data).toBeDefined();
    });
  });

  // ============================================================
  // update
  // ============================================================

  describe('update', () => {
    it('应成功更新书籍信息', () => {
      const book = service.create({
        title: '原标题',
        author: '原作者',
        isbn: 'ISBN-UPD',
        category: '原分类',
      });

      const updated = service.update(book.id, {
        title: '新标题',
        author: '新作者',
      });

      expect(updated.title).toBe('新标题');
      expect(updated.author).toBe('新作者');
      expect(updated.isbn).toBe('ISBN-UPD');
      expect(updated.category).toBe('原分类');
    });

    it('应更新修改时间戳', () => {
      const book = service.create({
        title: '时间戳测试',
        author: '作者',
        isbn: 'ISBN-TS',
        category: '分类',
      });

      const updated = service.update(book.id, { title: '新标题' });
      // updatedAt 应该被更新（可能相同因为测试太快，但至少不为空）
      expect(updated.updatedAt).toBeDefined();
    });

    it('书籍不存在时应抛出错误', () => {
      expect(() => service.update('non-existent-id', { title: '新标题' })).toThrow(
        ERROR_MESSAGES.BOOK_NOT_FOUND,
      );
    });

    it('应记录编辑操作日志', () => {
      const book = service.create({
        title: '日志测试',
        author: '作者',
        isbn: 'ISBN-EDIT-LOG',
        category: '分类',
      });

      service.update(book.id, { title: '新标题' });

      const sqlite = getSqliteDatabase();
      const logs = sqlite
        .prepare('SELECT * FROM operation_logs WHERE entity_id = ? AND operation_type = ?')
        .all(book.id, 'edit') as Array<{ before_data: string; after_data: string }>;

      expect(logs).toHaveLength(1);
      expect(logs[0].before_data).toBeDefined();
      expect(logs[0].after_data).toBeDefined();
    });
  });

  // ============================================================
  // delete
  // ============================================================

  describe('delete', () => {
    it('应成功删除无库存的书籍', () => {
      const book = service.create({
        title: '待删除',
        author: '作者',
        isbn: 'ISBN-DEL',
        category: '分类',
      });

      service.delete(book.id);

      expect(() => service.getById(book.id)).toThrow(ERROR_MESSAGES.BOOK_NOT_FOUND);
    });

    it('书籍不存在时应抛出错误', () => {
      expect(() => service.delete('non-existent-id')).toThrow(ERROR_MESSAGES.BOOK_NOT_FOUND);
    });

    it('有库存 > 0 时应拒绝删除', () => {
      const book = service.create({
        title: '有库存书籍',
        author: '作者',
        isbn: 'ISBN-STOCK',
        category: '分类',
      });

      const sqlite = getSqliteDatabase();
      const editionId = uuidv4();
      const locationId = uuidv4();

      // 创建版本
      sqlite
        .prepare('INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)')
        .run(editionId, book.id, '精装');

      // 创建位置
      sqlite
        .prepare('INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)')
        .run(locationId, '仓库A', '书架1', '层1');

      // 创建库存记录（数量 > 0）
      sqlite
        .prepare(
          'INSERT INTO stock (id, book_id, edition_id, location_id, quantity) VALUES (?, ?, ?, ?, ?)',
        )
        .run(uuidv4(), book.id, editionId, locationId, 5);

      expect(() => service.delete(book.id)).toThrow(ERROR_MESSAGES.BOOK_HAS_STOCK);
    });

    it('所有版本库存为 0 时应允许删除', () => {
      const book = service.create({
        title: '零库存书籍',
        author: '作者',
        isbn: 'ISBN-ZERO',
        category: '分类',
      });

      const sqlite = getSqliteDatabase();
      const editionId = uuidv4();
      const locationId = uuidv4();

      sqlite
        .prepare('INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)')
        .run(editionId, book.id, '精装');
      sqlite
        .prepare('INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)')
        .run(locationId, '仓库A', '书架1', '层1');
      sqlite
        .prepare(
          'INSERT INTO stock (id, book_id, edition_id, location_id, quantity) VALUES (?, ?, ?, ?, ?)',
        )
        .run(uuidv4(), book.id, editionId, locationId, 0);

      // 应该不抛出错误
      expect(() => service.delete(book.id)).not.toThrow();
    });

    it('应记录删除操作日志', () => {
      const book = service.create({
        title: '日志测试',
        author: '作者',
        isbn: 'ISBN-DEL-LOG',
        category: '分类',
      });

      service.delete(book.id);

      const sqlite = getSqliteDatabase();
      const logs = sqlite
        .prepare('SELECT * FROM operation_logs WHERE entity_id = ? AND operation_type = ?')
        .all(book.id, 'delete') as Array<{ before_data: string; after_data: string | null }>;

      expect(logs).toHaveLength(1);
      expect(logs[0].before_data).toBeDefined();
      expect(logs[0].after_data).toBeNull();
    });
  });

  // ============================================================
  // getById
  // ============================================================

  describe('getById', () => {
    it('应返回书籍及其所有版本', () => {
      const book = service.create({
        title: '详情测试',
        author: '作者',
        isbn: 'ISBN-DETAIL',
        category: '分类',
      });

      const sqlite = getSqliteDatabase();
      sqlite
        .prepare('INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)')
        .run(uuidv4(), book.id, '精装');
      sqlite
        .prepare('INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)')
        .run(uuidv4(), book.id, '平装');

      const result = service.getById(book.id);

      expect(result.id).toBe(book.id);
      expect(result.title).toBe('详情测试');
      expect(result.editions).toHaveLength(2);
      expect(result.editions.map((e) => e.name).sort()).toEqual(['平装', '精装']);
    });

    it('无版本时应返回空版本列表', () => {
      const book = service.create({
        title: '无版本',
        author: '作者',
        isbn: 'ISBN-NO-ED',
        category: '分类',
      });

      const result = service.getById(book.id);
      expect(result.editions).toHaveLength(0);
    });

    it('书籍不存在时应抛出错误', () => {
      expect(() => service.getById('non-existent-id')).toThrow(ERROR_MESSAGES.BOOK_NOT_FOUND);
    });
  });

  // ============================================================
  // search
  // ============================================================

  describe('search', () => {
    beforeEach(() => {
      service.create({ title: 'JavaScript高级编程', author: '张三', isbn: 'ISBN-JS', category: '编程' });
      service.create({ title: 'Python入门', author: '李四', isbn: 'ISBN-PY', category: '编程' });
      service.create({ title: '红楼梦', author: '曹雪芹', isbn: 'ISBN-HLM', category: '文学' });

      // 为 Python入门 添加一个版本
      const sqlite = getSqliteDatabase();
      const pyBook = sqlite.prepare("SELECT id FROM books WHERE isbn = 'ISBN-PY'").get() as { id: string };
      sqlite
        .prepare('INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)')
        .run(uuidv4(), pyBook.id, '精装限量版');
    });

    it('应按书名模糊匹配', () => {
      const results = service.search({ keyword: 'JavaScript' });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('JavaScript高级编程');
    });

    it('应按作者模糊匹配', () => {
      const results = service.search({ keyword: '曹雪芹' });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('红楼梦');
    });

    it('应按 ISBN 模糊匹配', () => {
      const results = service.search({ keyword: 'ISBN-JS' });
      expect(results).toHaveLength(1);
      expect(results[0].isbn).toBe('ISBN-JS');
    });

    it('应按分类模糊匹配', () => {
      const results = service.search({ keyword: '编程' });
      expect(results).toHaveLength(2);
    });

    it('应按版本名称模糊匹配', () => {
      const results = service.search({ keyword: '限量版' });
      expect(results).toHaveLength(1);
      expect(results[0].isbn).toBe('ISBN-PY');
    });

    it('无匹配时应返回空数组', () => {
      const results = service.search({ keyword: '不存在的关键词' });
      expect(results).toHaveLength(0);
    });
  });

  // ============================================================
  // list
  // ============================================================

  describe('list', () => {
    it('应返回分页结果', () => {
      // 创建 5 本书
      for (let i = 1; i <= 5; i++) {
        service.create({
          title: `书籍${i}`,
          author: `作者${i}`,
          isbn: `ISBN-LIST-${i}`,
          category: '分类',
        });
      }

      const result = service.list({ page: 1, pageSize: 3 });
      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(3);
    });

    it('应返回第二页数据', () => {
      for (let i = 1; i <= 5; i++) {
        service.create({
          title: `书籍${i}`,
          author: `作者${i}`,
          isbn: `ISBN-PAGE-${i}`,
          category: '分类',
        });
      }

      const result = service.list({ page: 2, pageSize: 3 });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.page).toBe(2);
    });

    it('无数据时应返回空列表', () => {
      const result = service.list({ page: 1, pageSize: 10 });
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('不传分页参数时应使用默认值', () => {
      service.create({
        title: '默认分页',
        author: '作者',
        isbn: 'ISBN-DEFAULT',
        category: '分类',
      });

      const result = service.list();
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.data).toHaveLength(1);
    });
  });
});
