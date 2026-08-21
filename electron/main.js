import { app, BrowserWindow, BrowserView, session, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
const paneViews = {}; // Armazena as 3 BrowserViews nativas com partições persistentes

function createPaneView(id) {
  const partition = `persist:pane-${id}`;
  const ses = session.fromPartition(partition);

  // Auto-permite mídia, câmera, autoplay e tela cheia
  ses.setPermissionRequestHandler((webContents, permission, callback) => callback(true));
  ses.setPermissionCheckHandler(() => true);

  const view = new BrowserView({
    webPreferences: {
      partition,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });

  // Garante que popups de autenticação (Google OAuth) herdem estritamente a partição da sua guia
  view.webContents.setWindowOpenHandler(({ url }) => {
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        webPreferences: {
          session: ses,
          contextIsolation: true
        }
      }
    };
  });

  // Notificações de eventos para a barra de navegação da UI
  view.webContents.on('did-navigate', (e, url) => {
    mainWindow?.webContents.send('pane-url-changed', { paneId: id, url });
  });
  view.webContents.on('did-navigate-in-page', (e, url, isMainFrame) => {
    if (isMainFrame) {
      mainWindow?.webContents.send('pane-url-changed', { paneId: id, url });
    }
  });
  view.webContents.on('page-title-updated', (e, title) => {
    mainWindow?.webContents.send('pane-title-changed', { paneId: id, title });
  });
  view.webContents.on('did-start-loading', () => {
    mainWindow?.webContents.send('pane-loading-changed', { paneId: id, loading: true });
  });
  view.webContents.on('did-stop-loading', () => {
    mainWindow?.webContents.send('pane-loading-changed', { paneId: id, loading: false });
  });

  return view;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Multi-Guias | Divisão de Tela Inteligente (Sessões Isoladas)',
    backgroundColor: '#0a0f1d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false
    }
  });

  // Inicializa as 3 BrowserViews com partições persistentes e isoladas no disco
  paneViews[1] = createPaneView(1);
  paneViews[2] = createPaneView(2);
  paneViews[3] = createPaneView(3);

  // Carrega a interface construída
  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Remove o menu superior padrão do Windows para visual imersivo
  mainWindow.setMenuBarVisibility(false);

  // Sincroniza o redimensionamento quando a janela do Windows é redimensionada
  mainWindow.on('resize', () => {
    mainWindow.webContents.send('window-resized');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Handlers IPC para controle das BrowserViews a partir da interface Multi-Guias
ipcMain.on('update-panes-bounds', (event, boundsMap) => {
  if (!mainWindow) return;

  Object.entries(boundsMap).forEach(([idStr, bounds]) => {
    const id = parseInt(idStr);
    const view = paneViews[id];
    if (!view) return;

    if (bounds.visible && bounds.width > 0 && bounds.height > 0) {
      // Anexa a view à janela se ainda não estiver anexada
      if (!mainWindow.getBrowserViews().includes(view)) {
        mainWindow.addBrowserView(view);
      }
      view.setBounds({
        x: Math.max(0, Math.floor(bounds.x)),
        y: Math.max(0, Math.floor(bounds.y)),
        width: Math.max(1, Math.floor(bounds.width)),
        height: Math.max(1, Math.floor(bounds.height))
      });
    } else {
      // Remove a view para não sobrepor a tela se estiver oculta ou no speed dial
      if (mainWindow.getBrowserViews().includes(view)) {
        mainWindow.removeBrowserView(view);
      }
    }
  });
});

ipcMain.on('pane-navigate', (event, { paneId, url }) => {
  const view = paneViews[paneId];
  if (view && url) {
    view.webContents.loadURL(url).catch(err => {
      console.log(`Erro ao carregar URL na Guia ${paneId}:`, err.message);
    });
  }
});

ipcMain.on('pane-reload', (event, { paneId }) => {
  const view = paneViews[paneId];
  if (view) {
    view.webContents.reload();
  }
});

ipcMain.on('pane-go-back', (event, { paneId }) => {
  const view = paneViews[paneId];
  if (view && view.webContents.canGoBack()) {
    view.webContents.goBack();
  }
});

ipcMain.on('pane-go-forward', (event, { paneId }) => {
  const view = paneViews[paneId];
  if (view && view.webContents.canGoForward()) {
    view.webContents.goForward();
  }
});

// Inicialização do Electron
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
