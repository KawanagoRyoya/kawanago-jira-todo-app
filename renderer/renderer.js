// renderer/renderer.js

let todos, backlog, currentView = 'todo';

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
document.getElementById('btn-delete-completed').addEventListener('click', async () => {
  todos   = todos.filter(t => t.status !== 'Done');
  backlog = backlog.filter(t => t.status !== 'Done');
  await window.electronAPI.store.set('todos', todos);
  await window.electronAPI.store.set('backlog', backlog);
  renderView();
  showNotification('完了タスクを削除しました');
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
    await window.electronAPI.store.set('todos', todos);
    renderView();
  } catch (err) {
    console.error(err);
    showNotification('スプリント取得に失敗しました: ' + err.message);
  }
});

// 始業報告：未完了タスクをクリップボードにコピー
document.getElementById('btn-report-start').addEventListener('click', async () => {
  const pending = todos.filter(t => t.status !== 'Done');
  if (pending.length === 0) {
    showNotification('未完了タスクはありません');
    return;
  }
  const text = pending.map(t => `・ ${t.description}`).join('\n');
  try {
    await window.electronAPI.copyText(text);
    showNotification('未完了タスクをクリップボードにコピーしました');
  } catch (err) {
    console.error(err);
    showNotification('コピーに失敗しました: ' + err.message);
  }
});

// 終業報告（Jira同期＋レポート）
document.getElementById('btn-report-end').addEventListener('click', async () => {
  try {
    await window.electronAPI.syncToJira({ todos, backlog });
    const report = await window.electronAPI.generateReport('end', todos);
    alert(report);
    todos = [];
    backlog = [];
    await window.electronAPI.store.set('todos', todos);
    await window.electronAPI.store.set('backlog', backlog);
    renderView();
  } catch (err) {
    console.error(err);
    showNotification('終業処理失敗: ' + err.message);
  }
});

// タスク追加設定
function setupAddTask(inputId, buttonId, listName) {
  const inputEl  = document.getElementById(inputId);
  const buttonEl = document.getElementById(buttonId);
  async function addTask() {
    const desc = inputEl.value.trim();
    if (!desc) return;
    const item = { description: desc, dueDate: null, status: listName === 'todos' ? 'ToDo' : 'Backlog' };
    if (listName === 'todos') {
      todos.push(item);
      await window.electronAPI.store.set('todos', todos);
    } else {
      backlog.push(item);
      await window.electronAPI.store.set('backlog', backlog);
    }
    inputEl.value = '';
    renderView();
  }
  buttonEl.addEventListener('click', addTask);
  inputEl.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') addTask();
  });
}

// 画面描画
function renderView() {
  const todoListEl    = document.getElementById('todo-list');
  const backlogListEl = document.getElementById('backlog-list');
  todoListEl.innerHTML    = '';
  backlogListEl.innerHTML = '';

  function createListItem(item, listArray, storeKey) {
    const li = document.createElement('li');
    li.draggable = true;

    const checkbox = document.createElement('input');
    checkbox.type    = 'checkbox';
    checkbox.checked = item.status === 'Done';
    const label = document.createElement('span');
    label.textContent = item.description + (item.dueDate ? ` (期限: ${item.dueDate})` : '');
    if (item.status === 'Done') label.style.textDecoration = 'line-through';
    checkbox.addEventListener('change', async () => {
      item.status = checkbox.checked ? 'Done' : (storeKey==='todos'?'ToDo':'Backlog');
      await window.electronAPI.store.set(storeKey, listArray);
      label.style.textDecoration = checkbox.checked ? 'line-through' : 'none';
    });

    li.appendChild(checkbox);
    li.appendChild(label);
    return li;
  }

  todos.forEach((item, idx) => {
    const li = createListItem(item, todos, 'todos');
    li.dataset.index = idx;
    todoListEl.appendChild(li);
  });
  enableDragAndDrop(todoListEl, todos, 'todos');

  backlog.forEach((item, idx) => {
    const li = createListItem(item, backlog, 'backlog');
    li.dataset.index = idx;
    backlogListEl.appendChild(li);
  });
  enableDragAndDrop(backlogListEl, backlog, 'backlog');

  document.getElementById('todo-tab').style.display    = currentView === 'todo'    ? 'block' : 'none';
  document.getElementById('backlog-tab').style.display = currentView === 'backlog' ? 'block' : 'none';
}

// ドラッグ＆ドロップ
function enableDragAndDrop(listEl, listArray, storeKey) {
  let dragSrcIndex = null;
  Array.from(listEl.children).forEach((li, idx) => {
    li.draggable = true;
    li.dataset.index = idx;
    li.addEventListener('dragstart', e => {
      dragSrcIndex = idx;
      e.dataTransfer.effectAllowed = 'move';
    });
    li.addEventListener('dragover', e => {
      e.preventDefault();
    });
    li.addEventListener('drop', async e => {
      e.preventDefault();
      const dst = parseInt(li.dataset.index, 10);
      if (dragSrcIndex===null || dragSrcIndex===dst) return;
      const [moved] = listArray.splice(dragSrcIndex, 1);
      listArray.splice(dst, 0, moved);
      await window.electronAPI.store.set(storeKey, listArray);
      renderView();
    });
  });
}

// 初期化
window.addEventListener('DOMContentLoaded', async () => {
  todos   = await window.electronAPI.store.get('todos')   || [];
  backlog = await window.electronAPI.store.get('backlog') || [];
  setupAddTask('new-todo-input',    'add-todo-button',    'todos');
  setupAddTask('new-backlog-input', 'add-backlog-button', 'backlog');
  renderView();
});