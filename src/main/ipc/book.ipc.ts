/**
 * 书籍管理 IPC 处理器
 */

import { ipcMain } from 'electron';
import { BOOK_CHANNELS } from '../../shared/ipc-channels';
import { BookService } from '../services/book.service';
import type {
  CreateBookInput,
  UpdateBookInput,
  SearchBookQuery,
  PaginationInput,
} from '../../shared/types';

const bookService = new BookService();

export function registerBookIpcHandlers(): void {
  ipcMain.handle(BOOK_CHANNELS.CREATE, (_event, data: CreateBookInput) => {
    try {
      return bookService.create(data);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(BOOK_CHANNELS.UPDATE, (_event, id: string, data: UpdateBookInput) => {
    try {
      return bookService.update(id, data);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(BOOK_CHANNELS.DELETE, (_event, id: string) => {
    try {
      bookService.delete(id);
      return { success: true };
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(BOOK_CHANNELS.GET_BY_ID, (_event, id: string) => {
    try {
      return bookService.getById(id);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(BOOK_CHANNELS.SEARCH, (_event, query: SearchBookQuery) => {
    try {
      return bookService.search(query);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(BOOK_CHANNELS.LIST, (_event, pagination?: PaginationInput) => {
    try {
      return bookService.list(pagination);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });
}
