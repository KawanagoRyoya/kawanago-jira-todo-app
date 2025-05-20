// Proxyを無効化
process.env.HTTP_PROXY = '';
process.env.HTTPS_PROXY = '';
process.env.NO_PROXY = '*';

require('dotenv').config();
const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const path = require('path');
const axios = require('axios');
const Store = require('electron-store');
const store = new Store();

// Jira API クライアント設定
const jiraClient = axios.create({
  baseURL: `${process.env.JIRA_BASE_URL}/rest/api/3`,
  auth: {
    username: process.env.JIRA_EMAIL,
    password: process.env.JIRA_API_TOKEN
  },
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// === electron-store IPC 非同期化 ===
ipcMain.handle('electron-store-get', async (_, key) => {
   const value = store.get(key);
   if ((key === 'todos' || key === 'backlog') && !Array.isArray(value)) {
     return [];
   }
   return value;
 });
 
ipcMain.handle('electron-store-set', async (_, key, val) => {
  store.set(key, val);
});

// === スプリント課題取得 ===
ipcMain.handle('fetch-jira-sprint', async (_, sprintId) => {
  const jql = `project = KTM AND Sprint = ${sprintId} ORDER BY created DESC`;
  const res = await jiraClient.get('/search', {
    params: { jql },
    paramsSerializer: params => `jql=${encodeURIComponent(params.jql)}`
  });
  return res.data.issues;
});

// === 課題同期（ToDo → Jira） ===
ipcMain.handle('sync-to-jira', async (_, changes) => {
  const results = [];
  for (const todo of changes.todos) {
    if (todo.issueId) {
      const transition = mapStatusToTransitionId(todo.status);
      await jiraClient.put(`/issue/${todo.issueId}/transitions`, {
        transition: { id: transition }
      });
      results.push({ issueId: todo.issueId, action: 'updated' });
    } else {
      const payload = {
        fields: {
          project: { key: process.env.JIRA_PROJECT_KEY },
          summary: todo.description,
          description: todo.description,
          issuetype: { name: 'Task' },
          duedate: todo.dueDate
        }
      };
      const createRes = await jiraClient.post('/issue', payload);
      results.push({ issueId: createRes.data.key, action: 'created' });
    }
  }
  return results;
});

function mapStatusToTransitionId(status) {
  return {
    'ToDo': '11',
    'Done': '31'
  }[status] || '11';
}

// === クリップボードコピー ===
ipcMain.handle('copy-to-clipboard', (_, text) => {
  clipboard.writeText(text);
});

// === レポート生成（始業/終業報告） ===
ipcMain.handle('generate-report', async (_, type, todos) => {
  const date = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  const pending = todos.filter(t => t.status !== 'Done');
  if (type === 'start') {
    return `【始業報告】\n${date}\n未完了タスク:\n${pending.map(t => `・${t.description}`).join('\n')}`;
  } else if (type === 'end') {
    return `【終業報告】\n${date}\n完了タスク:\n${todos.filter(t => t.status === 'Done').map(t => `・${t.description}`).join('\n')}`;
  } else {
    return `${date}\n不明なレポートタイプ: ${type}`;
  }
});