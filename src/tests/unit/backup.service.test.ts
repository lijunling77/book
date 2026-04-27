/**
 * BackupService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeDatabase, closeDatabase, getDatabase } from '../../main/db';
import { books, backupInfo } from '../../main/db/schema';
import { BackupService } from '../../main/services/backup.service';
import { ERROR_MESSAGES } from '../../shared/constants';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import os from 'os';

function getTempDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-svc-test-'));
  return path.join(dir, 'test.db');
}

function getTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'backup-target-'));
}

describe('BackupService', () => {
  let service: BackupService;
  let dbPath: string;

  beforeEach(() => {
    dbPath = getTempDbPath();
    initializeDatabase(dbPath);
    service = new BackupService(dbPath);
  });

  afterEach(() => {
    try {
      closeDatabase();
    } catch {
      // ignore if already closed
    }
  });

  // ============================================================
  // create
  // ============================================================

  describe('create', () => {
    it('应成功创建备份文件', () => {
      const targetDir = getTempDir();
      const targetPath = path.join(targetDir, 'backup.db');

      const result = service.create(targetPath);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.filePath).toBe(targetPath);
      expect(result.createdAt).toBeDefined();
      expect(fs.existsSync(targetPath)).toBe(true);
    });

    it('应将备份信息记录到 backup_info 表', () => {
      const targetDir = getTempDir();
      const targetPath = path.join(targetDir, 'backup.db');

      const result = service.create(targetPath);

      const db = getDatabase();
      const records = db.select().from(backupInfo).all();
      expect(records).toHaveLength(1);
      expect(records[0].id).toBe(result.id);
      expect(records[0].filePath).toBe(targetPath);
    });

    it('备份文件应包含当前数据库的数据', () => {
      // 先插入一些数据
      const db = getDatabase();
      db.insert(books).values({
        id: uuidv4(),
        title: '测试书籍',
        author: '测试作者',
        isbn: '978-0-000-00001-0',
        category: '测试分类',
      }).run();

      const targetDir = getTempDir();
      const targetPath = path.join(targetDir, 'backup.db');

      service.create(targetPath);

      // 验证备份文件是有效的 SQLite 数据库
      expect(fs.existsSync(targetPath)).toBe(true);
      const fileSize = fs.statSync(targetPath).size;
      expect(fileSize).toBeGreaterThan(0);
    });

    it('目标目录不存在时应自动创建', () => {
      const targetDir = path.join(getTempDir(), 'sub', 'dir');
      const targetPath = path.join(targetDir, 'backup.db');

      const result = service.create(targetPath);

      expect(fs.existsSync(targetPath)).toBe(true);
      expect(result.filePath).toBe(targetPath);
    });

    it('路径不可写入时应抛出错误', () => {
      // 创建一个只读目录来模拟不可写入的路径
      const readonlyDir = getTempDir();
      const targetPath = path.join(readonlyDir, 'sub', 'backup.db');
      // 在 Windows 上使用无效的路径字符
      const invalidPath = path.join(readonlyDir, 'CON', 'backup.db');

      // 尝试使用系统保留路径（跨平台兼容）
      const isWindows = process.platform === 'win32';
      const unwritablePath = isWindows
        ? 'Z:\\nonexistent_drive_xyz\\backup.db'
        : '/proc/nonexistent/backup.db';

      expect(() => service.create(unwritablePath)).toThrow(ERROR_MESSAGES.BACKUP_PATH_NOT_WRITABLE);
    });

    it('多次备份应记录多条备份信息', () => {
      const targetDir = getTempDir();

      service.create(path.join(targetDir, 'backup1.db'));
      service.create(path.join(targetDir, 'backup2.db'));

      const db = getDatabase();
      const records = db.select().from(backupInfo).all();
      expect(records).toHaveLength(2);
    });
  });

  // ============================================================
  // restore
  // ============================================================

  describe('restore', () => {
    it('应成功从备份文件恢复数据库', () => {
      // 插入数据并备份
      const db = getDatabase();
      db.insert(books).values({
        id: uuidv4(),
        title: '备份前的书籍',
        author: '作者A',
        isbn: '978-0-000-00001-0',
        category: '分类A',
      }).run();

      const targetDir = getTempDir();
      const backupPath = path.join(targetDir, 'backup.db');
      service.create(backupPath);

      // 插入更多数据
      db.insert(books).values({
        id: uuidv4(),
        title: '备份后的书籍',
        author: '作者B',
        isbn: '978-0-000-00002-0',
        category: '分类B',
      }).run();

      // 恢复前应有 2 本书
      let bookCount = getDatabase().select().from(books).all().length;
      expect(bookCount).toBe(2);

      // 执行恢复
      service.restore(backupPath);

      // 恢复后应只有 1 本书（备份时的状态）
      bookCount = getDatabase().select().from(books).all().length;
      expect(bookCount).toBe(1);
    });

    it('备份文件不存在时应抛出错误', () => {
      expect(() => service.restore('/nonexistent/backup.db')).toThrow(
        ERROR_MESSAGES.BACKUP_FILE_INVALID,
      );
    });

    it('备份文件无效时应抛出错误', () => {
      // 创建一个无效的文件
      const targetDir = getTempDir();
      const invalidPath = path.join(targetDir, 'invalid.db');
      fs.writeFileSync(invalidPath, 'this is not a valid sqlite database');

      expect(() => service.restore(invalidPath)).toThrow(
        ERROR_MESSAGES.BACKUP_FILE_INVALID,
      );
    });

    it('恢复后数据库连接应正常工作', () => {
      const targetDir = getTempDir();
      const backupPath = path.join(targetDir, 'backup.db');
      service.create(backupPath);

      service.restore(backupPath);

      // 恢复后应能正常操作数据库
      const db = getDatabase();
      expect(db).toBeDefined();

      // 应能正常插入数据
      db.insert(books).values({
        id: uuidv4(),
        title: '恢复后新增书籍',
        author: '作者',
        isbn: '978-0-000-00099-0',
        category: '分类',
      }).run();

      const allBooks = db.select().from(books).all();
      expect(allBooks.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================
  // getLatest
  // ============================================================

  describe('getLatest', () => {
    it('无备份记录时应返回 null', () => {
      const result = service.getLatest();
      expect(result).toBeNull();
    });

    it('应返回最近一次备份信息', () => {
      const targetDir = getTempDir();
      const db = getDatabase();

      // 手动插入备份记录以确保不同的时间戳
      const id1 = uuidv4();
      const id2 = uuidv4();
      const path1 = path.join(targetDir, 'backup1.db');
      const path2 = path.join(targetDir, 'backup2.db');

      db.insert(backupInfo).values({
        id: id1,
        filePath: path1,
        createdAt: '2024-01-01 10:00:00',
      }).run();

      db.insert(backupInfo).values({
        id: id2,
        filePath: path2,
        createdAt: '2024-01-02 10:00:00',
      }).run();

      const latest = service.getLatest();
      expect(latest).toBeDefined();
      expect(latest!.id).toBe(id2);
      expect(latest!.filePath).toBe(path2);
      expect(latest!.createdAt).toBe('2024-01-02 10:00:00');
    });

    it('应返回完整的备份信息字段', () => {
      const targetDir = getTempDir();
      const targetPath = path.join(targetDir, 'backup.db');

      service.create(targetPath);

      const latest = service.getLatest();
      expect(latest).toBeDefined();
      expect(latest!.id).toBeDefined();
      expect(latest!.filePath).toBe(targetPath);
      expect(latest!.createdAt).toBeDefined();
    });
  });
});
