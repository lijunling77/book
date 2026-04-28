/**
 * LocationService - 位置管理服务
 */

import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db';
import { locations, stock, books } from '../db/schema';
import { ERROR_MESSAGES } from '../../shared/constants';
import type {
  Location,
  CreateLocationInput,
  UpdateLocationInput,
  StockUnitAtLocation,
} from '../../shared/types';

export class LocationService {
  create(input: CreateLocationInput): Location {
    const db = getDatabase();

    const existing = db
      .select()
      .from(locations)
      .where(
        and(
          eq(locations.warehouse, input.warehouse),
          eq(locations.shelf, input.shelf),
          eq(locations.layer, input.layer),
        ),
      )
      .get();

    if (existing) throw new Error(ERROR_MESSAGES.LOCATION_ALREADY_EXISTS);

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const id = uuidv4();

    db.insert(locations).values({
      id,
      warehouse: input.warehouse,
      shelf: input.shelf,
      layer: input.layer,
      createdAt: now,
      updatedAt: now,
    }).run();

    return db.select().from(locations).where(eq(locations.id, id)).get()! as Location;
  }

  update(id: string, input: UpdateLocationInput): Location {
    const db = getDatabase();

    const existing = db.select().from(locations).where(eq(locations.id, id)).get();
    if (!existing) throw new Error(ERROR_MESSAGES.LOCATION_NOT_FOUND);

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const newWarehouse = input.warehouse ?? existing.warehouse;
    const newShelf = input.shelf ?? existing.shelf;
    const newLayer = input.layer ?? existing.layer;

    const hasChange =
      newWarehouse !== existing.warehouse ||
      newShelf !== existing.shelf ||
      newLayer !== existing.layer;

    if (hasChange) {
      const duplicate = db
        .select()
        .from(locations)
        .where(
          and(
            eq(locations.warehouse, newWarehouse),
            eq(locations.shelf, newShelf),
            eq(locations.layer, newLayer),
          ),
        )
        .get();

      if (duplicate) throw new Error(ERROR_MESSAGES.LOCATION_ALREADY_EXISTS);
    }

    const updateData: Record<string, unknown> = { updatedAt: now };
    if (input.warehouse !== undefined) updateData.warehouse = input.warehouse;
    if (input.shelf !== undefined) updateData.shelf = input.shelf;
    if (input.layer !== undefined) updateData.layer = input.layer;

    db.update(locations).set(updateData).where(eq(locations.id, id)).run();

    return db.select().from(locations).where(eq(locations.id, id)).get()! as Location;
  }

  delete(id: string): void {
    const db = getDatabase();

    const existing = db.select().from(locations).where(eq(locations.id, id)).get();
    if (!existing) throw new Error(ERROR_MESSAGES.LOCATION_NOT_FOUND);

    const stockRecords = db
      .select({ stockId: stock.id, quantity: stock.quantity })
      .from(stock)
      .where(eq(stock.locationId, id))
      .all();

    const nonZeroStock = stockRecords.filter((s) => s.quantity > 0);
    if (nonZeroStock.length > 0) {
      const error = new Error(ERROR_MESSAGES.LOCATION_HAS_STOCK) as Error & { stockList?: unknown[] };
      error.stockList = nonZeroStock;
      throw error;
    }

    db.delete(stock).where(eq(stock.locationId, id)).run();
    db.delete(locations).where(eq(locations.id, id)).run();
  }

  list(): Location[] {
    const db = getDatabase();
    return db.select().from(locations).all() as Location[];
  }

  getStock(locationId: string): StockUnitAtLocation[] {
    const db = getDatabase();

    const existing = db.select().from(locations).where(eq(locations.id, locationId)).get();
    if (!existing) throw new Error(ERROR_MESSAGES.LOCATION_NOT_FOUND);

    const results = db
      .select({
        bookId: stock.bookId,
        bookTitle: books.title,
        quantity: stock.quantity,
      })
      .from(stock)
      .innerJoin(books, eq(stock.bookId, books.id))
      .where(eq(stock.locationId, locationId))
      .all();

    return results as StockUnitAtLocation[];
  }
}
