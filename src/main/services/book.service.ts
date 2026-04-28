/**
 * BookService - 书籍管理服务
 * 提供书籍的 CRUD、搜索和分页查询功能
 */

import { eq, like, or, sql, count } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db';
import { books, editions, stock, bookImages, editionImages, operationLogs } from '../db/schema';
import { ERROR_MESSAGES, OPERATION_TYPES, ENTITY_TYPES, DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '../../shared/constants';
import type {
  Book,
  BookWithEditions,
  CreateBookInput,
  UpdateBookInput,
  SearchBookQuery,
  PaginationInput,
  PaginatedResult,
} from '../../shared/types';
import fs from 'fs';

/**
 * 记录操作日志（简单直接插入，后续会重构为 LogService）
 */
function logOperation(
  operationType: string,
  entityType: string,
  entityId: string,
  beforeData: unknown | null,
  afterData: unknown | null,
): void {
  const db = getDatabase();
  db.insert(operationLogs).values({
    id: uuidv4(),
    operationType,
    entityType,
    entityId,
    beforeData: beforeData ? JSON.stringify(beforeData) : null,
    afterData: afterData ? JSON.stringify(afterData) : null,
  }).run();
}

export class BookService {
  /**
   * 创建书籍
   * 1. 校验 ISBN 唯一性
   * 2. 创建书籍记录
   * 3. 记录操作日志
   */
  create(input: CreateBookInput): Book {
    const db = getDatabase();

    // 校验 ISBN 唯一性（仅当 ISBN 有值时）
    if (input.isbn) {
      const existing = db.select().from(books).where(eq(books.isbn, input.isbn)).get();
      if (existing) {
        throw new Error(ERROR_MESSAGES.ISBN_ALREADY_EXISTS);
      }
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const id = uuidv4();

    const newBook: typeof books.$inferInsert = {
      id,
      title: input.title,
      author: input.author ?? null,
      isbn: input.isbn ?? null,
      category: input.category ?? null,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(books).values(newBook).run();

    const created = db.select().from(books).where(eq(books.id, id)).get()!;

    // 记录操作日志
    logOperation(OPERATION_TYPES.CREATE, ENTITY_TYPES.BOOK, id, null, created);

    return created as Book;
  }

  /**
   * 更新书籍信息
   * 1. 更新书籍信息
   * 2. 记录修改时间戳
   * 3. 记录操作日志
   */
  update(id: string, input: UpdateBookInput): Book {
    const db = getDatabase();

    // 查找现有书籍
    const existing = db.select().from(books).where(eq(books.id, id)).get();
    if (!existing) {
      throw new Error(ERROR_MESSAGES.BOOK_NOT_FOUND);
    }

    const beforeData = { ...existing };
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const updateData: Record<string, unknown> = { updatedAt: now };
    if (input.title !== undefined) updateData.title = input.title;
    if (input.author !== undefined) updateData.author = input.author;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.description !== undefined) updateData.description = input.description;

    db.update(books).set(updateData).where(eq(books.id, id)).run();

    const updated = db.select().from(books).where(eq(books.id, id)).get()!;

    // 记录操作日志
    logOperation(OPERATION_TYPES.EDIT, ENTITY_TYPES.BOOK, id, beforeData, updated);

    return updated as Book;
  }

  /**
   * 删除书籍
   * 1. 校验所有版本库存数量，有库存 > 0 时拒绝删除并返回关联库存列表
   * 2. 删除时同时删除关联图片文件
   * 3. 记录操作日志
   */
  delete(id: string): void {
    const db = getDatabase();

    // 查找现有书籍
    const existing = db.select().from(books).where(eq(books.id, id)).get();
    if (!existing) {
      throw new Error(ERROR_MESSAGES.BOOK_NOT_FOUND);
    }

    // 查询该书籍所有版本的库存记录，检查是否有库存 > 0
    const stockRecords = db
      .select({
        stockId: stock.id,
        editionId: stock.editionId,
        locationId: stock.locationId,
        quantity: stock.quantity,
      })
      .from(stock)
      .where(eq(stock.bookId, id))
      .all();

    const nonZeroStock = stockRecords.filter((s) => s.quantity > 0);
    if (nonZeroStock.length > 0) {
      const error = new Error(ERROR_MESSAGES.BOOK_HAS_STOCK) as Error & { stockList?: unknown[] };
      error.stockList = nonZeroStock;
      throw error;
    }

    // 删除关联图片文件
    // 1. 删除书籍封面图片
    const bookImage = db.select().from(bookImages).where(eq(bookImages.bookId, id)).get();
    if (bookImage) {
      try {
        if (fs.existsSync(bookImage.filePath)) fs.unlinkSync(bookImage.filePath);
        if (fs.existsSync(bookImage.thumbnailPath)) fs.unlinkSync(bookImage.thumbnailPath);
      } catch {
        // 图片文件删除失败不阻塞书籍删除
      }
    }

    // 2. 删除所有版本的封面图片
    const bookEditions = db.select().from(editions).where(eq(editions.bookId, id)).all();
    for (const edition of bookEditions) {
      const edImage = db.select().from(editionImages).where(eq(editionImages.editionId, edition.id)).get();
      if (edImage) {
        try {
          if (fs.existsSync(edImage.filePath)) fs.unlinkSync(edImage.filePath);
          if (fs.existsSync(edImage.thumbnailPath)) fs.unlinkSync(edImage.thumbnailPath);
        } catch {
          // 图片文件删除失败不阻塞书籍删除
        }
      }
    }

    const beforeData = { ...existing };

    // 删除关联的库存记录（quantity 为 0 的记录）
    db.delete(stock).where(eq(stock.bookId, id)).run();

    // 删除书籍（级联删除版本、图片记录）
    db.delete(books).where(eq(books.id, id)).run();

    // 记录操作日志
    logOperation(OPERATION_TYPES.DELETE, ENTITY_TYPES.BOOK, id, beforeData, null);
  }

  /**
   * 根据 ID 获取书籍及其所有版本信息
   */
  getById(id: string): BookWithEditions {
    const db = getDatabase();

    const book = db.select().from(books).where(eq(books.id, id)).get();
    if (!book) {
      throw new Error(ERROR_MESSAGES.BOOK_NOT_FOUND);
    }

    const bookEditions = db.select().from(editions).where(eq(editions.bookId, id)).all();

    return {
      ...book,
      editions: bookEditions,
    } as BookWithEditions;
  }

  /**
   * 搜索书籍
   * 按书名、作者、ISBN、分类、版本名称模糊匹配
   */
  search(query: SearchBookQuery): Book[] {
    const db = getDatabase();
    const keyword = `%${query.keyword}%`;

    // 先查找版本名称匹配的书籍 ID
    const editionMatches = db
      .select({ bookId: editions.bookId })
      .from(editions)
      .where(like(editions.name, keyword))
      .all();

    const editionBookIds = editionMatches.map((e) => e.bookId);

    // 查询书籍本身字段匹配的记录
    const bookMatches = db
      .select()
      .from(books)
      .where(
        or(
          like(books.title, keyword),
          like(books.author, keyword),
          like(books.isbn, keyword),
          like(books.category, keyword),
        ),
      )
      .all();

    // 如果有版本名称匹配的书籍，也查出来
    let editionBookMatches: (typeof books.$inferSelect)[] = [];
    if (editionBookIds.length > 0) {
      // 使用 inArray 等效的方式：逐个查询并合并（避免复杂 SQL）
      for (const bookId of editionBookIds) {
        const book = db.select().from(books).where(eq(books.id, bookId)).get();
        if (book) {
          editionBookMatches.push(book);
        }
      }
    }

    // 合并去重
    const resultMap = new Map<string, typeof books.$inferSelect>();
    for (const book of bookMatches) {
      resultMap.set(book.id, book);
    }
    for (const book of editionBookMatches) {
      resultMap.set(book.id, book);
    }

    return Array.from(resultMap.values()) as Book[];
  }

  /**
   * 分页查询书籍列表
   */
  list(pagination?: PaginationInput): PaginatedResult<Book> {
    const db = getDatabase();
    const page = pagination?.page ?? DEFAULT_PAGE;
    const pageSize = pagination?.pageSize ?? DEFAULT_PAGE_SIZE;
    const offset = (page - 1) * pageSize;

    // 查询总数
    const totalResult = db.select({ count: count() }).from(books).get();
    const total = totalResult?.count ?? 0;

    // 查询分页数据
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
