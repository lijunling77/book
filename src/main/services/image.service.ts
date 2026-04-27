/**
 * ImageService - 图片管理服务
 * 使用 sharp 库处理图片
 * 支持图片上传（含缩略图生成）、删除、查询功能
 * 图片可关联到书籍或版本
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db';
import { bookImages, editionImages, books, editions } from '../db/schema';
import {
  ERROR_MESSAGES,
  IMAGE_MAX_SIZE_BYTES,
  SUPPORTED_IMAGE_EXTENSIONS,
} from '../../shared/constants';
import type { ImageInfo, ImageEntityType } from '../../shared/types';

/** 缩略图尺寸 */
const THUMBNAIL_SIZE = 200;

export class ImageService {
  private storageDir: string;

  /**
   * @param storageDir 图片存储根目录
   */
  constructor(storageDir: string) {
    this.storageDir = storageDir;
    // 确保存储目录存在
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
    const thumbnailDir = path.join(this.storageDir, 'thumbnails');
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }
  }

  /**
   * 上传图片
   * 1. 校验图片格式（JPG/PNG）和大小（≤5MB）
   * 2. 保存原图到本地存储目录
   * 3. 使用 sharp 生成缩略图（200x200）
   * 4. 关联到书籍或版本
   * 5. 已有图片时替换并删除原文件
   *
   * @param entityType 关联实体类型 ('book' | 'edition')
   * @param entityId 关联实体 ID
   * @param imageBuffer 图片文件 Buffer
   * @param fileName 原始文件名（用于格式校验）
   * @returns 图片信息
   */
  async upload(
    entityType: ImageEntityType,
    entityId: string,
    imageBuffer: Buffer,
    fileName: string,
  ): Promise<ImageInfo> {
    const db = getDatabase();

    // 校验实体存在性
    if (entityType === 'book') {
      const book = db.select().from(books).where(eq(books.id, entityId)).get();
      if (!book) {
        throw new Error(ERROR_MESSAGES.BOOK_NOT_FOUND);
      }
    } else {
      const edition = db.select().from(editions).where(eq(editions.id, entityId)).get();
      if (!edition) {
        throw new Error(ERROR_MESSAGES.EDITION_NOT_FOUND);
      }
    }

    // 校验图片格式
    const ext = path.extname(fileName).toLowerCase();
    if (!SUPPORTED_IMAGE_EXTENSIONS.includes(ext as typeof SUPPORTED_IMAGE_EXTENSIONS[number])) {
      throw new Error(ERROR_MESSAGES.UNSUPPORTED_IMAGE_FORMAT);
    }

    // 校验图片大小
    if (imageBuffer.length > IMAGE_MAX_SIZE_BYTES) {
      throw new Error(ERROR_MESSAGES.IMAGE_TOO_LARGE);
    }

    // 如果已有图片，先删除原文件
    await this.deleteExistingImage(entityType, entityId);

    // 生成文件名
    const id = uuidv4();
    const imageFileName = `${id}${ext}`;
    const thumbnailFileName = `${id}_thumb${ext}`;

    const filePath = path.join(this.storageDir, imageFileName);
    const thumbnailPath = path.join(this.storageDir, 'thumbnails', thumbnailFileName);

    // 保存原图
    fs.writeFileSync(filePath, imageBuffer);

    // 使用 sharp 生成缩略图（200x200，保持比例，填充）
    await sharp(imageBuffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: 'cover',
        position: 'centre',
      })
      .toFile(thumbnailPath);

    // 保存到数据库
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    if (entityType === 'book') {
      db.insert(bookImages)
        .values({
          id,
          bookId: entityId,
          filePath,
          thumbnailPath,
          createdAt: now,
        })
        .run();
    } else {
      db.insert(editionImages)
        .values({
          id,
          editionId: entityId,
          filePath,
          thumbnailPath,
          createdAt: now,
        })
        .run();
    }

    return {
      id,
      entityId,
      filePath,
      thumbnailPath,
      createdAt: now,
    };
  }

  /**
   * 删除图片文件并解除关联
   *
   * @param entityType 关联实体类型 ('book' | 'edition')
   * @param entityId 关联实体 ID
   */
  delete(entityType: ImageEntityType, entityId: string): void {
    this.deleteExistingImage(entityType, entityId);
  }

  /**
   * 获取图片路径
   * 版本优先显示版本封面，无版本封面时显示书籍默认封面，均无时返回 null
   *
   * @param entityType 关联实体类型 ('book' | 'edition')
   * @param entityId 关联实体 ID
   * @returns 图片文件路径，无图片时返回 null
   */
  get(entityType: ImageEntityType, entityId: string): string | null {
    const db = getDatabase();

    if (entityType === 'book') {
      const image = db
        .select({ filePath: bookImages.filePath })
        .from(bookImages)
        .where(eq(bookImages.bookId, entityId))
        .get();
      return image?.filePath ?? null;
    } else {
      // 版本：优先显示版本封面
      const edImage = db
        .select({ filePath: editionImages.filePath })
        .from(editionImages)
        .where(eq(editionImages.editionId, entityId))
        .get();

      if (edImage) {
        return edImage.filePath;
      }

      // 无版本封面时，查找书籍默认封面
      const edition = db
        .select({ bookId: editions.bookId })
        .from(editions)
        .where(eq(editions.id, entityId))
        .get();

      if (!edition) {
        return null;
      }

      const bookImage = db
        .select({ filePath: bookImages.filePath })
        .from(bookImages)
        .where(eq(bookImages.bookId, edition.bookId))
        .get();

      return bookImage?.filePath ?? null;
    }
  }

  /**
   * 获取缩略图路径
   * 版本优先显示版本封面，无版本封面时显示书籍默认封面，均无时返回 null
   *
   * @param entityType 关联实体类型 ('book' | 'edition')
   * @param entityId 关联实体 ID
   * @returns 缩略图路径，无图片时返回 null
   */
  getThumbnail(entityType: ImageEntityType, entityId: string): string | null {
    const db = getDatabase();

    if (entityType === 'book') {
      // 书籍直接返回书籍封面缩略图
      const image = db
        .select({ thumbnailPath: bookImages.thumbnailPath })
        .from(bookImages)
        .where(eq(bookImages.bookId, entityId))
        .get();
      return image?.thumbnailPath ?? null;
    } else {
      // 版本：优先显示版本封面
      const edImage = db
        .select({ thumbnailPath: editionImages.thumbnailPath })
        .from(editionImages)
        .where(eq(editionImages.editionId, entityId))
        .get();

      if (edImage) {
        return edImage.thumbnailPath;
      }

      // 无版本封面时，查找书籍默认封面
      const edition = db
        .select({ bookId: editions.bookId })
        .from(editions)
        .where(eq(editions.id, entityId))
        .get();

      if (!edition) {
        return null;
      }

      const bookImage = db
        .select({ thumbnailPath: bookImages.thumbnailPath })
        .from(bookImages)
        .where(eq(bookImages.bookId, edition.bookId))
        .get();

      return bookImage?.thumbnailPath ?? null;
    }
  }

  /**
   * 删除已有图片（内部方法）
   * 删除文件并从数据库中移除记录
   */
  private deleteExistingImage(entityType: ImageEntityType, entityId: string): void {
    const db = getDatabase();

    if (entityType === 'book') {
      const existing = db
        .select()
        .from(bookImages)
        .where(eq(bookImages.bookId, entityId))
        .get();

      if (existing) {
        // 删除文件
        try {
          if (fs.existsSync(existing.filePath)) fs.unlinkSync(existing.filePath);
          if (fs.existsSync(existing.thumbnailPath)) fs.unlinkSync(existing.thumbnailPath);
        } catch {
          // 文件删除失败不阻塞操作
        }
        // 删除数据库记录
        db.delete(bookImages).where(eq(bookImages.bookId, entityId)).run();
      }
    } else {
      const existing = db
        .select()
        .from(editionImages)
        .where(eq(editionImages.editionId, entityId))
        .get();

      if (existing) {
        // 删除文件
        try {
          if (fs.existsSync(existing.filePath)) fs.unlinkSync(existing.filePath);
          if (fs.existsSync(existing.thumbnailPath)) fs.unlinkSync(existing.thumbnailPath);
        } catch {
          // 文件删除失败不阻塞操作
        }
        // 删除数据库记录
        db.delete(editionImages).where(eq(editionImages.editionId, entityId)).run();
      }
    }
  }
}
