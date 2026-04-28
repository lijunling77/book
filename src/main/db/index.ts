/**
 * 数据库初始化模块
 * 使用 better-sqlite3 创建数据库连接，启用 WAL 模式和外键约束
 * 实现数据库文件损坏检测
 */

import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { ERROR_MESSAGES } from '../../shared/constants';

let db: BetterSQLite3Database<typeof schema> | null = null;
let sqliteDb: Database.Database | null = null;

/**
 * 创建所有数据表的 SQL 语句
 */
const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    description TEXT,
    location TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS stock (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id),
    quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    UNIQUE(book_id)
  );

  CREATE TABLE IF NOT EXISTS inbound_records (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id),
    inbound_date TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    purchase_price REAL NOT NULL CHECK(purchase_price >= 0),
    supplier TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS outbound_records (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL REFERENCES books(id),
    outbound_date TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    selling_price REAL NOT NULL CHECK(selling_price >= 0),
    buyer TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS stocktaking_tasks (
    id TEXT PRIMARY KEY,
    scope_type TEXT NOT NULL,
    scope_value TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress',
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS stocktaking_items (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES stocktaking_tasks(id) ON DELETE CASCADE,
    book_id TEXT NOT NULL REFERENCES books(id),
    system_quantity INTEGER NOT NULL,
    actual_quantity INTEGER,
    variance INTEGER,
    status TEXT
  );

  CREATE TABLE IF NOT EXISTS location_dict (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS backup_info (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
`;

/**
 * 初始化数据库连接
 * @param dbPath 数据库文件路径
 * @returns Drizzle ORM 数据库实例
 * @throws Error 当数据库文件损坏或不可读时
 */
export function initializeDatabase(dbPath: string): BetterSQLite3Database<typeof schema> {
  try {
    // 创建 better-sqlite3 连接
    sqliteDb = new Database(dbPath);

    // 数据库文件损坏检测：执行 integrity_check
    const integrityResult = sqliteDb.pragma('integrity_check') as Array<{ integrity_check: string }>;
    if (integrityResult.length === 0 || integrityResult[0].integrity_check !== 'ok') {
      sqliteDb.close();
      sqliteDb = null;
      throw new Error(ERROR_MESSAGES.DATABASE_CORRUPTED);
    }

    // 启用 WAL 模式（提升并发读写性能）
    sqliteDb.pragma('journal_mode = WAL');

    // 启用外键约束
    sqliteDb.pragma('foreign_keys = ON');

    // 创建所有数据表
    sqliteDb.exec(CREATE_TABLES_SQL);

    // 创建 Drizzle ORM 实例
    db = drizzle(sqliteDb, { schema });

    return db;
  } catch (error) {
    // 如果是我们自己抛出的损坏错误，直接重新抛出
    if (error instanceof Error && error.message === ERROR_MESSAGES.DATABASE_CORRUPTED) {
      throw error;
    }
    // 其他错误（如文件权限问题等）也包装为损坏错误
    throw new Error(ERROR_MESSAGES.DATABASE_CORRUPTED);
  }
}

/**
 * 获取当前数据库实例
 * @returns Drizzle ORM 数据库实例
 * @throws Error 当数据库未初始化时
 */
export function getDatabase(): BetterSQLite3Database<typeof schema> {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 initializeDatabase');
  }
  return db;
}

/**
 * 获取底层 better-sqlite3 数据库实例
 * 用于备份恢复等需要直接操作 SQLite 的场景
 * @returns better-sqlite3 数据库实例
 * @throws Error 当数据库未初始化时
 */
export function getSqliteDatabase(): Database.Database {
  if (!sqliteDb) {
    throw new Error('数据库未初始化，请先调用 initializeDatabase');
  }
  return sqliteDb;
}

/**
 * 关闭数据库连接
 */
export function closeDatabase(): void {
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
    db = null;
  }
}
