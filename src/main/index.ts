import { app, BrowserWindow, ipcMain } from 'electron'
import { AuthService } from './services/auth.service';

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // MANDATORY FOR SECURITY
      nodeIntegration: false,
    },
  });

}

app.whenReady().then(() => {
  createWindow();
  
  //------------------------------------------
  // IPC HANDLERS: React asks, Node.js answers
  //------------------------------------------
  ipcMain.handle('auth:login', async, username, password) => {
    try {
      const user = await AuthService.login(username, password);
      return { success: true, data: user};
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
})
