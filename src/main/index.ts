/**
 * Electron 主进程入口
 * 初始化数据库、注册所有 IPC 处理器、创建 BrowserWindow、加载渲染进程
 */

import { app, BrowserWindow, dialog } from 'electron';
import path from 'path';
import { initializeDatabase, closeDatabase } from './db';
import { registerAllIpcHandlers } from './ipc';

let mainWindow: BrowserWindow | null = null;

/**
 * 获取数据库文件路径
 * 存储在 Electron 的 userData 目录下
 */
function getDbPath(): string {
  return path.join(app.getPath('userData'), 'books.db');
}

/**
 * 初始化数据库连接
 * 启动时加载数据库，失败时弹出错误对话框并退出应用
 */
function initDb(): boolean {
  try {
    initializeDatabase(getDbPath());
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知数据库错误';
    dialog.showErrorBox(
      '数据库初始化失败',
      `无法打开数据库文件，应用将退出。\n\n错误信息：${message}`,
    );
    return false;
  }
}

/**
 * 创建主窗口
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: '我们的书库',
  });

  // In development, load from Vite dev server
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built renderer
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // 1. 初始化数据库
  const dbReady = initDb();
  if (!dbReady) {
    app.quit();
    return;
  }

  // 2. 注册所有 IPC 处理器
  registerAllIpcHandlers();

  // 3. 创建主窗口
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  closeDatabase();
});
