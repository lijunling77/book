import { ipcMain } from 'electron';
import { PROFIT_CHANNELS } from '../../shared/ipc-channels';
import { ProfitService } from '../services/profit.service';
import type { DateRange } from '../../shared/types';

const profitService = new ProfitService();

export function registerProfitIpcHandlers(): void {
  ipcMain.handle(PROFIT_CHANNELS.BY_BOOK, (_event, bookId: string, dateRange?: DateRange) => {
    try {
      return profitService.calculateByBook(bookId, dateRange);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });
}
