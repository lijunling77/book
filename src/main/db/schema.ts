/**
 * Drizzle ORM Schema 定义
 * 定义所有数据表结构、约束和关系
 */

import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ============================================================
// 书籍表
// ============================================================

export const books = sqliteTable('books', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  author: text('author').notNull(),
  isbn: text('isbn').notNull().unique(),
  category: text('category').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now','localtime'))`),
});

// ============================================================
// 版本表
// ============================================================

export const editions = sqliteTable('editions', {
  id: text('id').primaryKey(),
  bookId: text('book_id').notNull().references(() => books.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  alertThreshold: integer('alert_threshold'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now','localtime'))`),
}, (table) => ({
  bookIdNameUnique: uniqueIndex('editions_book_id_name_unique').on(table.bookId, table.name),
}));

// ============================================================
// 位置表
// ============================================================

export const locations = sqliteTable('locations', {
  id: text('id').primaryKey(),
  warehouse: text('warehouse').notNull(),
  shelf: text('shelf').notNull(),
  layer: text('layer').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now','localtime'))`),
}, (table) => ({
  warehouseShelfLayerUnique: uniqueIndex('locations_warehouse_shelf_layer_unique').on(table.warehouse, table.shelf, table.layer),
}));

// ============================================================
// 库存表
// ============================================================

export const stock = sqliteTable('stock', {
  id: text('id').primaryKey(),
  bookId: text('book_id').notNull().references(() => books.id),
  editionId: text('edition_id').notNull().references(() => editions.id),
  locationId: text('location_id').notNull().references(() => locations.id),
  quantity: integer('quantity').notNull().default(0),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now','localtime'))`),
}, (table) => ({
  bookEditionLocationUnique: uniqueIndex('stock_book_edition_location_unique').on(table.bookId, table.editionId, table.locationId),
}));

// ============================================================
// 入库记录表
// ============================================================

export const inboundRecords = sqliteTable('inbound_records', {
  id: text('id').primaryKey(),
  bookId: text('book_id').notNull().references(() => books.id),
  editionId: text('edition_id').notNull().references(() => editions.id),
  locationId: text('location_id').notNull().references(() => locations.id),
  inboundDate: text('inbound_date').notNull(),
  quantity: integer('quantity').notNull(),
  purchasePrice: real('purchase_price').notNull(),
  supplier: text('supplier'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now','localtime'))`),
});

// ============================================================
// 出库记录表
// ============================================================

export const outboundRecords = sqliteTable('outbound_records', {
  id: text('id').primaryKey(),
  bookId: text('book_id').notNull().references(() => books.id),
  editionId: text('edition_id').notNull().references(() => editions.id),
  locationId: text('location_id').notNull().references(() => locations.id),
  outboundDate: text('outbound_date').notNull(),
  quantity: integer('quantity').notNull(),
  sellingPrice: real('selling_price').notNull(),
  buyer: text('buyer'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now','localtime'))`),
});

// ============================================================
// 操作日志表
// ============================================================

export const operationLogs = sqliteTable('operation_logs', {
  id: text('id').primaryKey(),
  operationType: text('operation_type').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  beforeData: text('before_data'),
  afterData: text('after_data'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
});

// ============================================================
// 书籍图片表
// ============================================================

export const bookImages = sqliteTable('book_images', {
  id: text('id').primaryKey(),
  bookId: text('book_id').notNull().unique().references(() => books.id, { onDelete: 'cascade' }),
  filePath: text('file_path').notNull(),
  thumbnailPath: text('thumbnail_path').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
});

// ============================================================
// 版本图片表
// ============================================================

export const editionImages = sqliteTable('edition_images', {
  id: text('id').primaryKey(),
  editionId: text('edition_id').notNull().unique().references(() => editions.id, { onDelete: 'cascade' }),
  filePath: text('file_path').notNull(),
  thumbnailPath: text('thumbnail_path').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
});

// ============================================================
// 盘点任务表
// ============================================================

export const stocktakingTasks = sqliteTable('stocktaking_tasks', {
  id: text('id').primaryKey(),
  scopeType: text('scope_type').notNull(),
  scopeValue: text('scope_value').notNull(),
  status: text('status').notNull().default('in_progress'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
  completedAt: text('completed_at'),
});

// ============================================================
// 盘点项表
// ============================================================

export const stocktakingItems = sqliteTable('stocktaking_items', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => stocktakingTasks.id, { onDelete: 'cascade' }),
  bookId: text('book_id').notNull().references(() => books.id),
  editionId: text('edition_id').notNull().references(() => editions.id),
  locationId: text('location_id').notNull().references(() => locations.id),
  systemQuantity: integer('system_quantity').notNull(),
  actualQuantity: integer('actual_quantity'),
  variance: integer('variance'),
  status: text('status'),
});

// ============================================================
// 备份信息表
// ============================================================

export const backupInfo = sqliteTable('backup_info', {
  id: text('id').primaryKey(),
  filePath: text('file_path').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now','localtime'))`),
});
