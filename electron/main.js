import { app, BrowserWindow, BrowserView, session, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
const paneViews = {}; // Armazena as 3 BrowserViews com partições persistentes
const reloadBtnViews = {}; // Armazena os 3 botões flutuantes nativos em camada superior (TopBrowserView)

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

function createReloadButtonView(id) {
  const btnView = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  btnView.setBackgroundColor('#00000000');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body {
          width: 100%;
          height: 100%;
          background: transparent;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          user-select: none;
        }
        .reload-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(15, 23, 42, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.25);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0.45;
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
        }
        .reload-btn:hover {
          opacity: 1;
          transform: scale(1.15);
          background: rgba(15, 23, 42, 0.95);
          border-color: #38bdf8;
          color: #38bdf8;
          box-shadow: 0 0 18px rgba(56, 189, 248, 0.5), 0 4px 20px rgba(0, 0, 0, 0.6);
        }
        .reload-btn:active svg {
          transform: rotate(180deg);
        }
        svg {
          transition: transform 0.3s ease;
        }
      </style>
    </head>
    <body>
      <button class="reload-btn" id="btn-reload" title="Recarregar Guia ${id}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
        </svg>
      </button>
      <script>
        document.getElementById('btn-reload').addEventListener('click', () => {
          window.location.hash = 'reload-' + Date.now();
        });
      </script>
    </body>
    </html>
  `;

  btnView.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  btnView.webContents.on('did-navigate-in-page', () => {
    paneViews[id]?.webContents.reload();
  });

  return btnView;
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

  // Inicializa as 3 BrowserViews e os 3 botões flutuantes nativos
  [1, 2, 3].forEach(id => {
    paneViews[id] = createPaneView(id);
    reloadBtnViews[id] = createReloadButtonView(id);
  });

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
ipcMain.on('update-panes-bounds', (event, { boundsMap, isZen }) => {
  if (!mainWindow) return;

  Object.entries(boundsMap).forEach(([idStr, bounds]) => {
    const id = parseInt(idStr);
    const view = paneViews[id];
    const btnView = reloadBtnViews[id];
    if (!view) return;

    if (bounds.visible && bounds.width > 0 && bounds.height > 0) {
      // Anexa a view do site à janela se ainda não estiver anexada
      if (!mainWindow.getBrowserViews().includes(view)) {
        mainWindow.addBrowserView(view);
      }
      view.setBounds({
        x: Math.max(0, Math.floor(bounds.x)),
        y: Math.max(0, Math.floor(bounds.y)),
        width: Math.max(1, Math.floor(bounds.width)),
        height: Math.max(1, Math.floor(bounds.height))
      });

      // No modo Zen/Fullscreen (F10), anexa e eleva o botão flutuante nativo ao topo
      if (isZen && btnView) {
        if (!mainWindow.getBrowserViews().includes(btnView)) {
          mainWindow.addBrowserView(btnView);
        }
        mainWindow.setTopBrowserView(btnView);
        btnView.setBounds({
          x: Math.max(0, Math.floor(bounds.x + bounds.width / 2 - 20)),
          y: Math.max(0, Math.floor(bounds.y + 26)),
          width: 40,
          height: 40
        });
      } else if (btnView) {
        if (mainWindow.getBrowserViews().includes(btnView)) {
          mainWindow.removeBrowserView(btnView);
        }
      }
    } else {
      if (mainWindow.getBrowserViews().includes(view)) {
        mainWindow.removeBrowserView(view);
      }
      if (btnView && mainWindow.getBrowserViews().includes(btnView)) {
        mainWindow.removeBrowserView(btnView);
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
