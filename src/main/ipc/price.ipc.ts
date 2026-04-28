import { ipcMain } from 'electron';
import { PRICE_CHANNELS } from '../../shared/ipc-channels';
import { PriceService } from '../services/price.service';

const priceService = new PriceService();

export function registerPriceIpcHandlers(): void {
  ipcMain.handle(PRICE_CHANNELS.PURCHASE_HISTORY, (_event, bookId: string) => {
    try {
      return priceService.getPurchaseHistory(bookId);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(PRICE_CHANNELS.SELLING_HISTORY, (_event, bookId: string) => {
    try {
      return priceService.getSellingHistory(bookId);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });

  ipcMain.handle(PRICE_CHANNELS.STATS, (_event, bookId: string) => {
    try {
      return priceService.getStats(bookId);
    } catch (error) {
      return { error: true, message: error instanceof Error ? error.message : '未知错误' };
    }
  });
}
