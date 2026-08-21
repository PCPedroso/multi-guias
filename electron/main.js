import { app, BrowserWindow, session, ipcMain, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Multi-Guias | Divisão de Tela Inteligente',
    backgroundColor: '#0a0f1d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true, // Habilita o uso de <webview partition="persist:pane-X"> para multi-sessão isolada
      spellcheck: false
    }
  });

  // Configura permissões globais e de partição para mídia, autoplay e notificações
  ['persist:pane-1', 'persist:pane-2', 'persist:pane-3', 'default'].forEach(partitionName => {
    const ses = partitionName === 'default' ? session.defaultSession : session.fromPartition(partitionName);
    
    // Auto-permite câmera, microfone, autoplay e tela cheia
    ses.setPermissionRequestHandler((webContents, permission, callback) => {
      const allowedPermissions = ['media', 'geolocation', 'notifications', 'fullscreen', 'pointerLock', 'autoplay'];
      if (allowedPermissions.includes(permission)) {
        return callback(true);
      }
      callback(true);
    });

    // Permite popups de login abrirem no mesmo contexto da partição
    ses.setPermissionCheckHandler((webContents, permission) => {
      return true;
    });
  });

  // Carrega a interface
  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Remove o menu padrão do Windows para visual limpo
  mainWindow.setMenuBarVisibility(false);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Configurações de inicialização do Electron
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
