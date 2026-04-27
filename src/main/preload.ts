import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload script - exposes a safe IPC bridge to the renderer process.
 * Uses contextBridge to maintain context isolation while allowing
 * the renderer to communicate with the main process.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    return ipcRenderer.invoke(channel, ...args);
  },
  on: (channel: string, callback: (...args: unknown[]) => void): void => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
  removeAllListeners: (channel: string): void => {
    ipcRenderer.removeAllListeners(channel);
  },
});
