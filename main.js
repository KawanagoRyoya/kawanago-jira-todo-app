require('dotenv').config();
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const axios = require('axios');

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
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// IPC ハンドラ
ipcMain.handle('fetch-jira-sprint', async (_, sprintId) => {
  const jql = `sprint=${sprintId}`;
  const res = await jiraClient.get('/search', { params: { jql } });
  return res.data.issues;
});

ipcMain.handle('sync-to-jira', async (_, changes) => {
  const results = [];
  for (const todo of changes.todos) {
    if (todo.issueId) {
      // 課題ステータス更新
      const transitionId = mapStatusToTransitionId(todo.status);
      await jiraClient.put(`/issue/${todo.issueId}/transitions`, {
        transition: { id: transitionId }
      });
      results.push({ issueId: todo.issueId, action: 'updated' });
    } else {
      // 新規課題作成
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
  const map = { 'ToDo': '11', 'Done': '31' };
  return map[status] || '11';
}