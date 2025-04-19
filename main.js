const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// 報告・Jira同期用の IPC ハンドラを追加
ipcMain.handle('fetch-jira-sprint', async (_, sprintId) => {
  // Axios で Jira API 呼び出し
});

ipcMain.handle('sync-to-jira', async (_, changes) => {
  // ToDo->Jira 更新処理
});

ipcMain.handle('generate-report', (_, type, todos) => {
  // reports/templates.js を利用してレポート作成
});