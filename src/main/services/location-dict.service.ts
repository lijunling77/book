/**
 * LocationDictService - 位置字典管理服务
 * 提供位置字典的增删查功能
 */

import { eq, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db';
import { locationDict } from '../db/schema';
import type { LocationDict } from '../../shared/types';

export class LocationDictService {
  /**
   * 获取所有位置，按名称排序
   */
  list(): LocationDict[] {
    const db = getDatabase();

    const rows = db
      .select()
      .from(locationDict)
      .orderBy(asc(locationDict.name))
      .all();

    return rows as LocationDict[];
  }

  /**
   * 创建位置
   * @throws 当名称已存在时抛出错误
   */
  create(name: string): LocationDict {
    const db = getDatabase();

    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('位置名称不能为空');
    }

    const existing = db
      .select()
      .from(locationDict)
      .where(eq(locationDict.name, trimmed))
      .get();

    if (existing) {
      throw new Error('该位置名称已存在');
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const id = uuidv4();

    db.insert(locationDict)
      .values({ id, name: trimmed, createdAt: now })
      .run();

    const created = db
      .select()
      .from(locationDict)
      .where(eq(locationDict.id, id))
      .get()!;

    return created as LocationDict;
  }

  /**
   * 删除位置
   */
  delete(id: string): void {
    const db = getDatabase();

    const existing = db
      .select()
      .from(locationDict)
      .where(eq(locationDict.id, id))
      .get();

    if (!existing) {
      throw new Error('位置不存在');
    }

    db.delete(locationDict).where(eq(locationDict.id, id)).run();
  }
}
