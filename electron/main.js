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
      webviewTag: true,
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

    ses.setPermissionCheckHandler(() => true);
  });

  // Garante que cada popup/janela de autenticação (ex: Google OAuth) herde estritamente a partição da sua guia
  app.on('web-contents-created', (event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          webPreferences: {
            session: contents.session, // Partição isolada mantida!
            contextIsolation: true
          }
        }
      };
    });
  });

  // Carrega a interface construída
  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Remove o menu padrão do Windows para visual limpo e moderno
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
