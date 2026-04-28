/**
 * BackupService - 数据备份与恢复服务
 * 提供数据库备份、恢复和最近备份信息查询功能
 * 备份通过复制 SQLite 数据库文件实现
 * 恢复通过关闭连接、覆盖数据库文件、重新初始化实现
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { eq, desc } from 'drizzle-orm';
import { getDatabase, getSqliteDatabase, closeDatabase, initializeDatabase } from '../db';
import { backupInfo } from '../db/schema';
import { ERROR_MESSAGES } from '../../shared/constants';
import type { BackupInfo } from '../../shared/types';

export class BackupService {
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * 创建数据库备份
   * 将 SQLite 数据库文件复制到用户指定路径
   * 记录备份时间和路径到 backup_info 表
   *
   * @param targetPath 备份目标文件路径
   * @returns 备份信息
   * @throws Error 路径不可写入时
   */
  create(targetPath: string): BackupInfo {
    // 校验目标路径是否可写入
    const targetDir = path.dirname(targetPath);
    try {
      // 确保目标目录存在
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      // 测试目录是否可写
      fs.accessSync(targetDir, fs.constants.W_OK);
    } catch {
      throw new Error(ERROR_MESSAGES.BACKUP_PATH_NOT_WRITABLE);
    }

    try {
      // 将 WAL 中的数据写入主数据库文件，确保备份完整
      const sqlite = getSqliteDatabase();
      sqlite.pragma('wal_checkpoint(TRUNCATE)');

      // 复制数据库文件到目标路径
      fs.copyFileSync(this.dbPath, targetPath);
    } catch {
      throw new Error(ERROR_MESSAGES.BACKUP_PATH_NOT_WRITABLE);
    }

    // 记录备份信息到数据库
    const db = getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    db.insert(backupInfo)
      .values({
        id,
        filePath: targetPath,
        createdAt: now,
      })
      .run();

    const record = db
      .select()
      .from(backupInfo)
      .where(eq(backupInfo.id, id))
      .get()!;

    return record as BackupInfo;
  }

  /**
   * 从备份文件恢复数据库
   * 1. 校验备份文件有效性
   * 2. 关闭当前数据库连接
   * 3. 复制备份文件覆盖数据库文件
   * 4. 重新初始化数据库连接
   *
   * @param filePath 备份文件路径
   * @throws Error 文件无效或损坏时
   */
  restore(filePath: string): void {
    // 校验备份文件是否存在
    if (!fs.existsSync(filePath)) {
      throw new Error(ERROR_MESSAGES.BACKUP_FILE_INVALID);
    }

    // 校验备份文件是否为有效的 SQLite 数据库
    try {
      const testDb = new Database(filePath, { readonly: true });
      const result = testDb.pragma('integrity_check') as Array<{ integrity_check: string }>;
      if (result.length === 0 || result[0].integrity_check !== 'ok') {
        testDb.close();
        throw new Error(ERROR_MESSAGES.BACKUP_FILE_INVALID);
      }
      testDb.close();
    } catch (error) {
      if (error instanceof Error && error.message === ERROR_MESSAGES.BACKUP_FILE_INVALID) {
        throw error;
      }
      throw new Error(ERROR_MESSAGES.BACKUP_FILE_INVALID);
    }

    // 关闭当前数据库连接
    closeDatabase();

    try {
      // 复制备份文件覆盖当前数据库文件
      fs.copyFileSync(filePath, this.dbPath);

      // 重新初始化数据库连接
      initializeDatabase(this.dbPath);
    } catch (error) {
      // 尝试重新初始化（即使覆盖失败也要恢复连接）
      try {
        initializeDatabase(this.dbPath);
      } catch {
        // 如果重新初始化也失败，抛出原始错误
      }

      if (error instanceof Error && error.message === ERROR_MESSAGES.DATABASE_CORRUPTED) {
        throw new Error(ERROR_MESSAGES.BACKUP_FILE_INVALID);
      }
      throw new Error(ERROR_MESSAGES.BACKUP_FILE_INVALID);
    }
  }

  /**
   * 获取最近一次成功备份的信息
   * 按 createdAt 倒序取第一条
   *
   * @returns 最近备份信息，无备份时返回 null
   */
  getLatest(): BackupInfo | null {
    const db = getDatabase();

    const latest = db
      .select()
      .from(backupInfo)
      .orderBy(desc(backupInfo.createdAt))
      .limit(1)
      .get();

    return (latest as BackupInfo) ?? null;
  }
}
