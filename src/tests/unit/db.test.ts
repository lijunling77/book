/**
 * 数据库初始化和 Schema 单元测试
 */

import { describe, it, expect, afterEach } from 'vitest';
import { initializeDatabase, getDatabase, getSqliteDatabase, closeDatabase } from '../../main/db';
import * as schema from '../../main/db/schema';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import os from 'os';

function getTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'book-db-test-'));
  return path.join(dir, 'test.db');
}

describe('数据库初始化', () => {
  afterEach(() => {
    closeDatabase();
  });

  it('应成功初始化数据库并创建所有表', () => {
    const dbPath = getTempDbPath();
    const db = initializeDatabase(dbPath);
    expect(db).toBeDefined();

    const sqlite = getSqliteDatabase();
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as Array<{ name: string }>;

    const tableNames = tables.map((t) => t.name).sort();
    const expectedTables = [
      'backup_info',
      'book_images',
      'books',
      'edition_images',
      'editions',
      'inbound_records',
      'locations',
      'operation_logs',
      'outbound_records',
      'stock',
      'stocktaking_items',
      'stocktaking_tasks',
    ].sort();

    expect(tableNames).toEqual(expectedTables);
  });

  it('应启用 WAL 模式', () => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    const sqlite = getSqliteDatabase();
    const result = sqlite.pragma('journal_mode') as Array<{ journal_mode: string }>;
    expect(result[0].journal_mode).toBe('wal');
  });

  it('应启用外键约束', () => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    const sqlite = getSqliteDatabase();
    const result = sqlite.pragma('foreign_keys') as Array<{ foreign_keys: number }>;
    expect(result[0].foreign_keys).toBe(1);
  });

  it('数据库文件损坏时应抛出错误', () => {
    const dbPath = getTempDbPath();
    // 写入无效数据模拟损坏的数据库文件
    fs.writeFileSync(dbPath, 'this is not a valid sqlite database file content!!!');
    expect(() => initializeDatabase(dbPath)).toThrow('数据库文件损坏或不可读');
  });

  it('getDatabase 在未初始化时应抛出错误', () => {
    expect(() => getDatabase()).toThrow('数据库未初始化');
  });

  it('getSqliteDatabase 在未初始化时应抛出错误', () => {
    expect(() => getSqliteDatabase()).toThrow('数据库未初始化');
  });

  it('closeDatabase 应正常关闭连接', () => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    closeDatabase();
    expect(() => getDatabase()).toThrow('数据库未初始化');
  });
});

describe('唯一性约束', () => {
  afterEach(() => {
    closeDatabase();
  });

  it('books.isbn 应全局唯一', () => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    const sqlite = getSqliteDatabase();

    const id1 = uuidv4();
    const id2 = uuidv4();
    sqlite.prepare(
      'INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)'
    ).run(id1, '书籍A', '作者A', 'ISBN-001', '分类A');

    expect(() => {
      sqlite.prepare(
        'INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)'
      ).run(id2, '书籍B', '作者B', 'ISBN-001', '分类B');
    }).toThrow();
  });

  it('editions(book_id, name) 应组合唯一', () => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    const sqlite = getSqliteDatabase();

    const bookId = uuidv4();
    sqlite.prepare(
      'INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)'
    ).run(bookId, '书籍A', '作者A', 'ISBN-001', '分类A');

    const edId1 = uuidv4();
    const edId2 = uuidv4();
    sqlite.prepare(
      'INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)'
    ).run(edId1, bookId, '精装');

    expect(() => {
      sqlite.prepare(
        'INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)'
      ).run(edId2, bookId, '精装');
    }).toThrow();
  });

  it('editions 同名不同 book_id 应允许', () => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    const sqlite = getSqliteDatabase();

    const bookId1 = uuidv4();
    const bookId2 = uuidv4();
    sqlite.prepare(
      'INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)'
    ).run(bookId1, '书籍A', '作者A', 'ISBN-001', '分类A');
    sqlite.prepare(
      'INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)'
    ).run(bookId2, '书籍B', '作者B', 'ISBN-002', '分类B');

    const edId1 = uuidv4();
    const edId2 = uuidv4();
    sqlite.prepare(
      'INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)'
    ).run(edId1, bookId1, '精装');

    // 不同书籍下同名版本应该成功
    expect(() => {
      sqlite.prepare(
        'INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)'
      ).run(edId2, bookId2, '精装');
    }).not.toThrow();
  });

  it('locations(warehouse, shelf, layer) 应组合唯一', () => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    const sqlite = getSqliteDatabase();

    const locId1 = uuidv4();
    const locId2 = uuidv4();
    sqlite.prepare(
      'INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)'
    ).run(locId1, '仓库A', '书架1', '层1');

    expect(() => {
      sqlite.prepare(
        'INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)'
      ).run(locId2, '仓库A', '书架1', '层1');
    }).toThrow();
  });

  it('stock(book_id, edition_id, location_id) 应组合唯一', () => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    const sqlite = getSqliteDatabase();

    const bookId = uuidv4();
    const editionId = uuidv4();
    const locationId = uuidv4();

    sqlite.prepare(
      'INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)'
    ).run(bookId, '书籍A', '作者A', 'ISBN-001', '分类A');
    sqlite.prepare(
      'INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)'
    ).run(editionId, bookId, '精装');
    sqlite.prepare(
      'INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)'
    ).run(locationId, '仓库A', '书架1', '层1');

    const stockId1 = uuidv4();
    const stockId2 = uuidv4();
    sqlite.prepare(
      'INSERT INTO stock (id, book_id, edition_id, location_id, quantity) VALUES (?, ?, ?, ?, ?)'
    ).run(stockId1, bookId, editionId, locationId, 10);

    expect(() => {
      sqlite.prepare(
        'INSERT INTO stock (id, book_id, edition_id, location_id, quantity) VALUES (?, ?, ?, ?, ?)'
      ).run(stockId2, bookId, editionId, locationId, 5);
    }).toThrow();
  });
});

describe('业务约束', () => {
  afterEach(() => {
    closeDatabase();
  });

  it('stock.quantity 不能为负数', () => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    const sqlite = getSqliteDatabase();

    const bookId = uuidv4();
    const editionId = uuidv4();
    const locationId = uuidv4();

    sqlite.prepare(
      'INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)'
    ).run(bookId, '书籍A', '作者A', 'ISBN-001', '分类A');
    sqlite.prepare(
      'INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)'
    ).run(editionId, bookId, '精装');
    sqlite.prepare(
      'INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)'
    ).run(locationId, '仓库A', '书架1', '层1');

    expect(() => {
      sqlite.prepare(
        'INSERT INTO stock (id, book_id, edition_id, location_id, quantity) VALUES (?, ?, ?, ?, ?)'
      ).run(uuidv4(), bookId, editionId, locationId, -1);
    }).toThrow();
  });

  it('stock.quantity 可以为零', () => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    const sqlite = getSqliteDatabase();

    const bookId = uuidv4();
    const editionId = uuidv4();
    const locationId = uuidv4();

    sqlite.prepare(
      'INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)'
    ).run(bookId, '书籍A', '作者A', 'ISBN-001', '分类A');
    sqlite.prepare(
      'INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)'
    ).run(editionId, bookId, '精装');
    sqlite.prepare(
      'INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)'
    ).run(locationId, '仓库A', '书架1', '层1');

    expect(() => {
      sqlite.prepare(
        'INSERT INTO stock (id, book_id, edition_id, location_id, quantity) VALUES (?, ?, ?, ?, ?)'
      ).run(uuidv4(), bookId, editionId, locationId, 0);
    }).not.toThrow();
  });

  it('inbound_records.quantity 必须大于零', () => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    const sqlite = getSqliteDatabase();

    const bookId = uuidv4();
    const editionId = uuidv4();
    const locationId = uuidv4();

    sqlite.prepare(
      'INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)'
    ).run(bookId, '书籍A', '作者A', 'ISBN-001', '分类A');
    sqlite.prepare(
      'INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)'
    ).run(editionId, bookId, '精装');
    sqlite.prepare(
      'INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)'
    ).run(locationId, '仓库A', '书架1', '层1');

    // quantity = 0 应失败
    expect(() => {
      sqlite.prepare(
        'INSERT INTO inbound_records (id, book_id, edition_id, location_id, inbound_date, quantity, purchase_price) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(uuidv4(), bookId, editionId, locationId, '2024-01-01', 0, 10.0);
    }).toThrow();

    // quantity = -1 应失败
    expect(() => {
      sqlite.prepare(
        'INSERT INTO inbound_records (id, book_id, edition_id, location_id, inbound_date, quantity, purchase_price) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(uuidv4(), bookId, editionId, locationId, '2024-01-01', -1, 10.0);
    }).toThrow();
  });

  it('outbound_records.quantity 必须大于零', () => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    const sqlite = getSqliteDatabase();

    const bookId = uuidv4();
    const editionId = uuidv4();
    const locationId = uuidv4();

    sqlite.prepare(
      'INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)'
    ).run(bookId, '书籍A', '作者A', 'ISBN-001', '分类A');
    sqlite.prepare(
      'INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)'
    ).run(editionId, bookId, '精装');
    sqlite.prepare(
      'INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)'
    ).run(locationId, '仓库A', '书架1', '层1');

    // quantity = 0 应失败
    expect(() => {
      sqlite.prepare(
        'INSERT INTO outbound_records (id, book_id, edition_id, location_id, outbound_date, quantity, selling_price) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(uuidv4(), bookId, editionId, locationId, '2024-01-01', 0, 20.0);
    }).toThrow();
  });

  it('inbound_records.purchase_price 不能为负数', () => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    const sqlite = getSqliteDatabase();

    const bookId = uuidv4();
    const editionId = uuidv4();
    const locationId = uuidv4();

    sqlite.prepare(
      'INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)'
    ).run(bookId, '书籍A', '作者A', 'ISBN-001', '分类A');
    sqlite.prepare(
      'INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)'
    ).run(editionId, bookId, '精装');
    sqlite.prepare(
      'INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)'
    ).run(locationId, '仓库A', '书架1', '层1');

    expect(() => {
      sqlite.prepare(
        'INSERT INTO inbound_records (id, book_id, edition_id, location_id, inbound_date, quantity, purchase_price) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(uuidv4(), bookId, editionId, locationId, '2024-01-01', 5, -10.0);
    }).toThrow();
  });

  it('outbound_records.selling_price 不能为负数', () => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    const sqlite = getSqliteDatabase();

    const bookId = uuidv4();
    const editionId = uuidv4();
    const locationId = uuidv4();

    sqlite.prepare(
      'INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)'
    ).run(bookId, '书籍A', '作者A', 'ISBN-001', '分类A');
    sqlite.prepare(
      'INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)'
    ).run(editionId, bookId, '精装');
    sqlite.prepare(
      'INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)'
    ).run(locationId, '仓库A', '书架1', '层1');

    expect(() => {
      sqlite.prepare(
        'INSERT INTO outbound_records (id, book_id, edition_id, location_id, outbound_date, quantity, selling_price) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(uuidv4(), bookId, editionId, locationId, '2024-01-01', 5, -20.0);
    }).toThrow();
  });

  it('purchase_price 可以为零', () => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    const sqlite = getSqliteDatabase();

    const bookId = uuidv4();
    const editionId = uuidv4();
    const locationId = uuidv4();

    sqlite.prepare(
      'INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)'
    ).run(bookId, '书籍A', '作者A', 'ISBN-001', '分类A');
    sqlite.prepare(
      'INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)'
    ).run(editionId, bookId, '精装');
    sqlite.prepare(
      'INSERT INTO locations (id, warehouse, shelf, layer) VALUES (?, ?, ?, ?)'
    ).run(locationId, '仓库A', '书架1', '层1');

    expect(() => {
      sqlite.prepare(
        'INSERT INTO inbound_records (id, book_id, edition_id, location_id, inbound_date, quantity, purchase_price) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(uuidv4(), bookId, editionId, locationId, '2024-01-01', 5, 0);
    }).not.toThrow();
  });
});

describe('外键约束', () => {
  afterEach(() => {
    closeDatabase();
  });

  it('editions.book_id 应引用 books.id', () => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    const sqlite = getSqliteDatabase();

    expect(() => {
      sqlite.prepare(
        'INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)'
      ).run(uuidv4(), 'non-existent-book-id', '精装');
    }).toThrow();
  });

  it('删除书籍时应级联删除版本', () => {
    const dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    const sqlite = getSqliteDatabase();

    const bookId = uuidv4();
    const editionId = uuidv4();

    sqlite.prepare(
      'INSERT INTO books (id, title, author, isbn, category) VALUES (?, ?, ?, ?, ?)'
    ).run(bookId, '书籍A', '作者A', 'ISBN-001', '分类A');
    sqlite.prepare(
      'INSERT INTO editions (id, book_id, name) VALUES (?, ?, ?)'
    ).run(editionId, bookId, '精装');

    sqlite.prepare('DELETE FROM books WHERE id = ?').run(bookId);

    const editions = sqlite.prepare('SELECT * FROM editions WHERE book_id = ?').all(bookId);
    expect(editions).toHaveLength(0);
  });
});
