// renderer/renderer.js

// ローカルストレージから読み込み
let todos   = window.electronAPI.store.get('todos')   || [];
let backlog = window.electronAPI.store.get('backlog') || [];
let currentView = 'todo';

const notification = document.getElementById('notification');
function showNotification(msg) {
  notification.textContent = msg;
  notification.style.display = 'block';
  setTimeout(() => notification.style.display = 'none', 5000);
}

// ── ツールバー ──
document.getElementById('btn-todo').addEventListener('click', () => {
  currentView = 'todo';
  renderView();
});
document.getElementById('btn-backlog').addEventListener('click', () => {
  currentView = 'backlog';
  renderView();
});

// Sprint ID 手動入力
const sprintInputArea = document.getElementById('sprint-input-area');
document.getElementById('btn-fetch').addEventListener('click', () => {
  sprintInputArea.style.display = 'block';
});
document.getElementById('sprint-submit').addEventListener('click', async () => {
  const sprintId = document.getElementById('sprint-id-input').value;
  if (!sprintId) return;
  sprintInputArea.style.display = 'none';
  try {
    const issues = await window.electronAPI.fetchSprint(sprintId);
    todos = issues.map(i => ({
      issueId: i.key,
      description: i.fields.summary,
      dueDate: i.fields.duedate,
      status: 'ToDo'
    }));
    window.electronAPI.store.set('todos', todos);
    renderView();
  } catch (err) {
    console.error(err);
    showNotification('スプリント取得に失敗しました: ' + err.message);
  }
});

// 始業報告
document.getElementById('btn-report-start').addEventListener('click', async () => {
  try {
    const report = await window.electronAPI.generateReport('start', todos);
    alert(report);
  } catch (err) {
    console.error(err);
    showNotification('始業報告失敗: ' + err.message);
  }
});

// 終業報告（Jira同期＋レポート出力）
document.getElementById('btn-report-end').addEventListener('click', async () => {
  try {
    await window.electronAPI.syncToJira({ todos, backlog });
    const report = await window.electronAPI.generateReport('end', todos);
    alert(report);
    todos = [];
    backlog = [];
    window.electronAPI.store.set('todos', todos);
    window.electronAPI.store.set('backlog', backlog);
    renderView();
  } catch (err) {
    console.error(err);
    showNotification('終業処理失敗: ' + err.message);
  }
});

// ── タスク追加機能 ──
function setupAddTask(inputId, buttonId, listName) {
  const inputEl  = document.getElementById(inputId);
  const buttonEl = document.getElementById(buttonId);

  async function addTask() {
    const description = inputEl.value.trim();
    if (!description) return;
    const item = {
      description,
      dueDate: null,
      status: listName === 'todos' ? 'ToDo' : 'Backlog'
    };
    if (listName === 'todos') {
      todos.push(item);
      window.electronAPI.store.set('todos', todos);
    } else {
      backlog.push(item);
      window.electronAPI.store.set('backlog', backlog);
    }
    inputEl.value = '';
    renderView();
  }

  buttonEl.addEventListener('click', addTask);
  inputEl.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') addTask();
  });
}

// ── 画面描画 ──
function renderView() {
  const todoListEl    = document.getElementById('todo-list');
  const backlogListEl = document.getElementById('backlog-list');
  todoListEl.innerHTML    = '';
  backlogListEl.innerHTML = '';

  // ToDo リスト描画
  todos.forEach(item => {
    const li = document.createElement('li');
    const checkbox = document.createElement('input');
    checkbox.type    = 'checkbox';
    checkbox.checked = item.status === 'Done';
    const label = document.createElement('span');
    label.textContent = item.description + (item.dueDate ? ` (期限: ${item.dueDate})` : '');
    if (item.status === 'Done') {
      label.style.textDecoration = 'line-through';
    }
    checkbox.addEventListener('change', () => {
      item.status = checkbox.checked ? 'Done' : 'ToDo';
      window.electronAPI.store.set('todos', todos);
      label.style.textDecoration = checkbox.checked ? 'line-through' : 'none';
    });
    li.appendChild(checkbox);
    li.appendChild(label);
    todoListEl.appendChild(li);
  });

  // Backlog リスト描画
  backlog.forEach(item => {
    const li = document.createElement('li');
    const checkbox = document.createElement('input');
    checkbox.type    = 'checkbox';
    checkbox.checked = item.status === 'Done';
    const label = document.createElement('span');
    label.textContent = item.description + (item.dueDate ? ` (期限: ${item.dueDate})` : '');
    if (item.status === 'Done') {
      label.style.textDecoration = 'line-through';
    }
    checkbox.addEventListener('change', () => {
      item.status = checkbox.checked ? 'Done' : 'Backlog';
      window.electronAPI.store.set('backlog', backlog);
      label.style.textDecoration = checkbox.checked ? 'line-through' : 'none';
    });
    li.appendChild(checkbox);
    li.appendChild(label);
    backlogListEl.appendChild(li);
  });

  // タブ表示切替
  document.getElementById('todo-tab').style.display    = currentView === 'todo'    ? 'block' : 'none';
  document.getElementById('backlog-tab').style.display = currentView === 'backlog' ? 'block' : 'none';
}

// 初期化
window.addEventListener('DOMContentLoaded', () => {
  setupAddTask('new-todo-input',    'add-todo-button',    'todos');
  setupAddTask('new-backlog-input', 'add-backlog-button', 'backlog');
  renderView();
});