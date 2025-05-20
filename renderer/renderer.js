// renderer/renderer.js

let todos = [];
let backlog = [];
let currentView = 'todo';

const sectionLimit = {
  mustone: 1,
  medium:  3,
  small:   5,
  other: Infinity
};

const notification = document.getElementById('notification');
function showNotification(msg) {
  notification.textContent = msg;
  notification.style.display = 'block';
  setTimeout(() => notification.style.display = 'none', 3000);
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
  const sprintId = document.getElementById('sprint-id-input').value.trim();
  if (!sprintId) return;
  sprintInputArea.style.display = 'none';
  try {
    const issues = await window.electronAPI.fetchSprint(sprintId);
    todos = issues.map(i => ({
      issueId:    i.key,
      description:i.fields.summary,
      dueDate:    i.fields.duedate,
      status:     'ToDo',
      section:    'other'
    }));
    await window.electronAPI.store.set('todos', todos);
    renderView();
  } catch (err) {
    console.error(err);
    showNotification('スプリント取得に失敗しました: ' + err.message);
  }
});

// 始業報告：未完了タスクをクリップボードへコピー
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

// 終業報告（レポート生成）
document.getElementById('btn-report-end').addEventListener('click', async () => {
  try {
    // 完了タスク／未完了タスクを分離
    const completed = todos.filter(t => t.status === 'Done');
    const pending   = todos.filter(t => t.status !== 'Done');

    // テキスト整形
    const completedText = completed.map(t => `・ ${t.description}`).join('\n');
    const pendingText   = pending.map(t => `・ ${t.description}`).join('\n');
    const reportText = `<完了>\n${completedText}\n\n<継続>\n${pendingText}`;

    // クリップボードにコピー
    await window.electronAPI.copyText(reportText);
    showNotification('終業報告レポートをクリップボードにコピーしました');
  } catch (err) {
    console.error(err);
    showNotification('終業報告コピーに失敗しました: ' + err.message);
  }
});

// ── タスク追加機能 ──
function setupAddTask(inputId, buttonId, listName) {
  const inputEl  = document.getElementById(inputId);
  const buttonEl = document.getElementById(buttonId);

  async function addTask() {
    const desc = inputEl.value.trim();
    if (!desc) return;
    const item = {
      description: desc,
      dueDate:     null,
      status:      'ToDo',
      section:     listName === 'todos' ? 'other' : undefined
    };
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

// ── 画面描画 ──
function renderView() {
  document.getElementById('todo-tab').style.display    = currentView === 'todo'    ? 'block' : 'none';
  document.getElementById('backlog-tab').style.display = currentView === 'backlog' ? 'block' : 'none';

  const sections = {
    mustone:  document.getElementById('section-mustone-list'),
    medium:   document.getElementById('section-medium-list'),
    small:    document.getElementById('section-small-list'),
    other:    document.getElementById('section-other-list')
  };
  const backlogEl = document.getElementById('backlog-list');

  Object.values(sections).forEach(el => el.innerHTML = '');
  backlogEl.innerHTML = '';

  // ToDo セクション描画
  todos.forEach((item, idx) => {
    const li = document.createElement('li');
    li.dataset.todoIndex = idx;

    const checkbox = document.createElement('input');
    checkbox.type    = 'checkbox';
    checkbox.checked = item.status === 'Done';

    const label = document.createElement('span');
    label.textContent = item.description + (item.dueDate ? ` (期限: ${item.dueDate})` : '');
    if (item.status === 'Done') label.style.textDecoration = 'line-through';

    checkbox.addEventListener('change', async () => {
      item.status = checkbox.checked ? 'Done' : 'ToDo';
      await window.electronAPI.store.set('todos', todos);
      label.style.textDecoration = checkbox.checked ? 'line-through' : 'none';
    });

    li.append(checkbox, label);

    // dragstart/dragend は要素生成ごとに
    li.draggable = true;
    li.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', li.dataset.todoIndex);
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
    });

    sections[item.section].appendChild(li);
  });

  // Backlog セクション描画
  backlog.forEach((item, idx) => {
    const li = document.createElement('li');

    const checkbox = document.createElement('input');
    checkbox.type    = 'checkbox';
    checkbox.checked = item.status === 'Done';

    const label = document.createElement('span');
    label.textContent = item.description + (item.dueDate ? ` (期限: ${item.dueDate})` : '');
    if (item.status === 'Done') label.style.textDecoration = 'line-through';

    checkbox.addEventListener('change', async () => {
      item.status = checkbox.checked ? 'Done' : 'Backlog';
      await window.electronAPI.store.set('backlog', backlog);
      label.style.textDecoration = checkbox.checked ? 'line-through' : 'none';
    });

    li.append(checkbox, label);
    li.draggable = true;
    li.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', li.dataset.todoIndex);
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
    });

    backlogEl.appendChild(li);
  });
}

// ── ドロップ処理を一度だけ登録 ──
async function handleDropEvent(e, sectionKey) {
  e.preventDefault();
  const srcIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
  if (isNaN(srcIdx)) return;

  const srcItem = todos[srcIdx];
  const targetCount = todos.filter(t => t.section === sectionKey).length;
  if (sectionLimit[sectionKey] < targetCount + (srcItem.section !== sectionKey ? 1 : 0)) {
    showNotification('セクションの上限を超えています');
    return;
  }

  todos.splice(srcIdx, 1);
  srcItem.section = sectionKey;
  todos.push(srcItem);

  await window.electronAPI.store.set('todos', todos);
  renderView();
}

window.addEventListener('DOMContentLoaded', async () => {
  todos   = (await window.electronAPI.store.get('todos'))   || [];
  backlog = (await window.electronAPI.store.get('backlog')) || [];
  todos = todos.map(t => ({ section: 'other', status: 'ToDo', ...t }));

  setupAddTask('new-todo-input',    'add-todo-button',    'todos');
  setupAddTask('new-backlog-input', 'add-backlog-button', 'backlog');

  // セクションごとに dragover/drop を一度だけ登録
  const sections = {
    mustone:  document.getElementById('section-mustone-list'),
    medium:   document.getElementById('section-medium-list'),
    small:    document.getElementById('section-small-list'),
    other:    document.getElementById('section-other-list')
  };
  Object.entries(sections).forEach(([key, listEl]) => {
    listEl.addEventListener('dragover', e => e.preventDefault());
    listEl.addEventListener('drop', e => handleDropEvent(e, key));
  });

  renderView();
});