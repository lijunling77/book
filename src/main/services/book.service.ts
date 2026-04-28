/**
 * BookService - 书籍管理服务
 * 提供书籍的 CRUD、搜索和分页查询功能
 */

import { eq, like, or, count } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase, getSqliteDatabase } from '../db';
import { books, stock, inboundRecords, outboundRecords, locationDict } from '../db/schema';
import { ERROR_MESSAGES, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '../../shared/constants';
import type {
  Book,
  CreateBookInput,
  UpdateBookInput,
  SearchBookQuery,
  PaginationInput,
  PaginatedResult,
} from '../../shared/types';

/**
 * 如果位置不在字典里，自动添加
 */
function syncLocationDict(location: string | null | undefined): void {
  if (!location || !location.trim()) return;
  const db = getDatabase();
  const trimmed = location.trim();
  const existing = db.select().from(locationDict).where(eq(locationDict.name, trimmed)).get();
  if (!existing) {
    db.insert(locationDict).values({
      id: uuidv4(),
      name: trimmed,
    }).run();
  }
}

export class BookService {
  /**
   * 创建书籍
   */
  create(input: CreateBookInput): Book {
    const db = getDatabase();

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const id = uuidv4();

    const newBook: typeof books.$inferInsert = {
      id,
      title: input.title,
      author: input.author ?? null,
      description: input.description ?? null,
      location: input.location ?? null,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(books).values(newBook).run();

    syncLocationDict(input.location);

    const created = db.select().from(books).where(eq(books.id, id)).get()!;

    return created as Book;
  }

  /**
   * 更新书籍信息
   */
  update(id: string, input: UpdateBookInput): Book {
    const db = getDatabase();

    const existing = db.select().from(books).where(eq(books.id, id)).get();
    if (!existing) {
      throw new Error(ERROR_MESSAGES.BOOK_NOT_FOUND);
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const updateData: Record<string, unknown> = { updatedAt: now };
    if (input.title !== undefined) updateData.title = input.title;
    if (input.author !== undefined) updateData.author = input.author;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.location !== undefined) updateData.location = input.location;

    db.update(books).set(updateData).where(eq(books.id, id)).run();

    if (input.location !== undefined) {
      syncLocationDict(input.location);
    }

    const updated = db.select().from(books).where(eq(books.id, id)).get()!;

    return updated as Book;
  }

  /**
   * 删除书籍
   * 校验所有库存数量，有库存 > 0 时拒绝删除
   */
  delete(id: string): void {
    const db = getDatabase();
    const sqliteDb = getSqliteDatabase();

    const existing = db.select().from(books).where(eq(books.id, id)).get();
    if (!existing) {
      throw new Error(ERROR_MESSAGES.BOOK_NOT_FOUND);
    }

    // 检查是否有入库记录
    const inboundCount = db.select({ count: count() }).from(inboundRecords).where(eq(inboundRecords.bookId, id)).get();
    if (inboundCount && inboundCount.count > 0) {
      throw new Error('该书籍有交易记录，无法删除');
    }

    // 检查是否有出库记录
    const outboundCount = db.select({ count: count() }).from(outboundRecords).where(eq(outboundRecords.bookId, id)).get();
    if (outboundCount && outboundCount.count > 0) {
      throw new Error('该书籍有交易记录，无法删除');
    }

    // 没有交易记录，安全删除
    const transaction = sqliteDb.transaction(() => {
      db.delete(stock).where(eq(stock.bookId, id)).run();
      db.delete(books).where(eq(books.id, id)).run();
    });

    transaction();
  }

  /**
   * 根据 ID 获取书籍
   */
  getById(id: string): Book {
    const db = getDatabase();

    const book = db.select().from(books).where(eq(books.id, id)).get();
    if (!book) {
      throw new Error(ERROR_MESSAGES.BOOK_NOT_FOUND);
    }

    return book as Book;
  }

  /**
   * 搜索书籍
   * 按书名、作者模糊匹配
   */
  search(query: SearchBookQuery): Book[] {
    const db = getDatabase();
    const keyword = `%${query.keyword}%`;

    const bookMatches = db
      .select()
      .from(books)
      .where(
        or(
          like(books.title, keyword),
          like(books.author, keyword),
        ),
      )
      .all();

    return bookMatches as Book[];
  }

  /**
   * 分页查询书籍列表
   */
  list(pagination?: PaginationInput): PaginatedResult<Book> {
    const db = getDatabase();
    const page = pagination?.page ?? DEFAULT_PAGE;
    const pageSize = pagination?.pageSize ?? DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    const totalResult = db.select({ count: count() }).from(books).get();
    const total = totalResult?.count ?? 0;

    const data = db
      .select()
      .from(books)
      .limit(pageSize)
      .offset(offset)
      .all();

    return {
      data: data as Book[],
      total,
      page,
      pageSize,
    };
  }
}
