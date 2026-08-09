// @ts-check

export const RENDERER_URL = 'app://portreeve/index.html';

/** @param {string} preload */
export function browserWindowOptions(preload) {
  return {
    width: 1040,
    height: 720,
    minWidth: 760,
    minHeight: 560,
    show: false,
    title: 'PortReeve',
    backgroundColor: '#f5f1e8',
    webPreferences: {
      preload,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webviewTag: false,
      spellcheck: false,
    },
  };
}

/**
 * @param {import('electron').BrowserWindow} window
 */
export function secureWindowNavigation(window) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== RENDERER_URL) event.preventDefault();
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
}

/**
 * Keep collection active only while the desktop is actually visible, and
 * collect fresh evidence whenever the user returns to it.
 *
 * @param {Pick<import('electron').BrowserWindow, 'on'|'once'|'isVisible'|'isMinimized'>} window
 * @param {{refresh(): Promise<unknown>, start(): void, stop(): void}} coordinator
 */
export function bindWindowRefresh(window, coordinator) {
  const startIfVisible = () => {
    if (window.isVisible() && !window.isMinimized()) coordinator.start();
  };
  const refreshIfVisible = () => {
    if (window.isVisible() && !window.isMinimized()) {
      void coordinator.refresh();
      coordinator.start();
    }
  };
  window.on('focus', refreshIfVisible);
  window.on('show', startIfVisible);
  window.on('restore', refreshIfVisible);
  window.on('hide', () => coordinator.stop());
  window.on('minimize', () => coordinator.stop());
  window.once('closed', () => coordinator.stop());
}

/**
 * Attached launcher commands are application-owned. Prevent the BrowserWindow from
 * disappearing while those groups are live so the renderer can offer Stop or cancel
 * the exit attempt. No renderer response can bypass this fresh main-process check.
 *
 * @param {Pick<import('electron').BrowserWindow, 'on'|'once'|'removeListener'>} window
 * @param {{launcherCloseState(): {allowed: boolean, attached: unknown[]}}} coordinator
 * @param {(state: unknown) => void} onBlocked
 */
export function bindWindowCloseGuard(window, coordinator, onBlocked) {
  /** @param {{preventDefault(): void}} event */
  const guard = (event) => {
    const state = coordinator.launcherCloseState();
    if (state.allowed) return;
    event.preventDefault();
    onBlocked(state);
  };
  window.on('close', guard);
  window.once('closed', () => window.removeListener('close', guard));
}
