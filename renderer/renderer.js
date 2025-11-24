// renderer/renderer.js

let todos = [];
let backlog = [];
let currentView = 'todo';

const sectionLimit = {
  mustone: 1,
  medium:  3,
  small:   5,
  other:  Infinity
};

// 通知表示
const notification = document.getElementById('notification');
function showNotification(msg) {
  const notification = document.getElementById('notification');
  if (!notification) return;       // 要素が無ければ何もしない
  notification.textContent = msg;
  notification.style.display = 'block';
  setTimeout(() => notification.style.display = 'none', 3000);
}

// ナビボタンのアクティブ切替
function setActiveNav(activeId) {
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(activeId).classList.add('active');
}

// ── ツールバーイベント ──
document.getElementById('btn-todo').addEventListener('click', () => {
  setActiveNav('btn-todo');
  currentView = 'todo';
  renderView();
});
document.getElementById('btn-backlog').addEventListener('click', () => {
  setActiveNav('btn-backlog');
  currentView = 'backlog';
  renderView();
});
document.getElementById('btn-delete-completed').addEventListener('click', async () => {
  todos   = todos.filter(t => t.status !== 'Done');
  backlog = backlog.filter(t => t.status !== 'Done');
  await window.electronAPI.store.set('todos', todos);
  await window.electronAPI.store.set('backlog', backlog);
  showNotification('完了タスクを削除しました');
  renderView();
});

// Sprint取得 → 入力欄表示
const sprintInputEl  = document.getElementById('sprint-id-input');
const sprintSubmitEl = document.getElementById('sprint-submit');
document.getElementById('btn-fetch').addEventListener('click', () => {
  setActiveNav('btn-fetch');
  sprintInputEl.style.display  = 'block';
  sprintSubmitEl.style.display = 'block';
});
sprintSubmitEl.addEventListener('click', async () => {
  const sprintId = sprintInputEl.value.trim();
  if (!sprintId) return;
  sprintInputEl.style.display  = 'none';
  sprintSubmitEl.style.display = 'none';
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

// 始業報告
document.getElementById('btn-report-start').addEventListener('click', async () => {
  const sectionsInfo = [
    { key: 'mustone', label: 'マストワン' },
    { key: 'medium',  label: '中' },
    { key: 'small',   label: '小' }
  ];
  let lines = [];
  for (const sec of sectionsInfo) {
    const list = todos.filter(t => t.status !== 'Done' && t.section === sec.key);
    if (list.length) {
      lines.push(`<${sec.label}>`);
      lines.push(...list.map(t => `・ ${t.description}`));
    }
  }
  if (!lines.length) {
    showNotification('未完了タスクはありません');
    return;
  }
  const text = lines.join('\n');
  try {
    await window.electronAPI.copyText(text);
    showNotification('始業報告レポートをクリップボードにコピーしました');
  } catch (err) {
    console.error(err);
    showNotification('コピーに失敗しました: ' + err.message);
  }
});

// 就業報告
document.getElementById('btn-report-end').addEventListener('click', async () => {
  try {
    const completed = todos.filter(t => t.status === 'Done');
    const pending   = todos.filter(t => t.status !== 'Done');
    const compText  = completed.map(t => `・ ${t.description}`).join('\n');
    const pendText  = pending  .map(t => `・ ${t.description}`).join('\n');
    const reportText = `<完了>\n${compText}\n\n<継続>\n${pendText}`;
    await window.electronAPI.copyText(reportText);
    showNotification('終業報告レポートをクリップボードにコピーしました');
  } catch (err) {
    console.error(err);
    showNotification('終業報告コピーに失敗しました: ' + err.message);
  }
});

// ── タスク追加設定 ──
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

// ── ToDo セクション描画 ──
function renderTodoSections() {
  const sectionsEls = {
    mustone: document.getElementById('section-mustone-list'),
    medium:  document.getElementById('section-medium-list'),
    small:   document.getElementById('section-small-list'),
    other:   document.getElementById('section-other-list')
  };
  Object.values(sectionsEls).forEach(el => el.innerHTML = '');
  todos.forEach((item, idx) => {
    const li = document.createElement('li');
    li.dataset.todoIndex = idx;
    
    // 完了状態の場合はclassを追加
    if (item.status === 'Done') {
      li.classList.add('completed');
    }

    // 完了チェック
    const cb = document.createElement('input');
    cb.type    = 'checkbox';
    cb.checked = item.status === 'Done';
    cb.addEventListener('change', async () => {
      item.status = cb.checked ? 'Done' : 'ToDo';
      
      // ✅ DOMを消さずにliに状態クラスだけ付ける
      li.classList.toggle('completed', cb.checked);
      
      await window.electronAPI.store.set('todos', todos);
    });

    // SVGアイコン
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 200 25');
    svg.setAttribute('class', 'todo__icon');
    svg.innerHTML = `
      <path class="todo__line"  d="M21 12.3h168v0.1z"></path>
      <path class="todo__box"   d="M21 12.7v5c0 1.3-1 2.3-2.3 2.3H8.3C7 20 6 19 6 17.7V7.3C6 6 7 5 8.3 5h10.4C20 5 21 6 21 7.3v5.4"></path>
      <path class="todo__check" d="M10 13l2 2 5-5"></path>
      <circle class="todo__circle" cx="13.5" cy="12.5" r="10"></circle>
    `;

    // 編集（ダブルクリック）
    const lbl = document.createElement('span');
    lbl.textContent = item.description;
    lbl.addEventListener('dblclick', () => {
      const inp = document.createElement('input');
      inp.type  = 'text';
      inp.value = item.description;
      inp.addEventListener('keydown', async e => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          if (e.key === 'Enter') {
            item.description = inp.value.trim() || item.description;
            await window.electronAPI.store.set('todos', todos);
          }
          renderView();
        }
      });
      inp.addEventListener('blur', async () => {
        item.description = inp.value.trim() || item.description;
        await window.electronAPI.store.set('todos', todos);
        renderView();
      });
      li.replaceChild(inp, lbl);
      inp.focus();
    });

    // 右端：Backlogへ移動ボタン
    const moveBtn = document.createElement('button');
    moveBtn.className = 'icon-btn move-btn';
    moveBtn.title = 'Backlogへ移動';
    moveBtn.textContent = '📥';
    moveBtn.addEventListener('click', () => moveTodoToBacklog(idx));

    li.append(cb, svg, lbl, moveBtn);
    li.draggable = true;
    li.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', idx);
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
    });

    sectionsEls[item.section].appendChild(li);
  });
}

// ── Backlog リスト描画 ──
function renderBacklogList() {
  const ul = document.getElementById('backlog-list');
  ul.innerHTML = '';
  backlog.forEach((item, idx) => {
    const li = document.createElement('li');
    
    // 完了状態の場合はclassを追加
    if (item.status === 'Done') {
      li.classList.add('completed');
    }

    const cb = document.createElement('input');
    cb.type    = 'checkbox';
    cb.checked = item.status === 'Done';
    cb.addEventListener('change', async () => {
      item.status = cb.checked ? 'Done' : 'Backlog';
      
      // ✅ DOMを消さずにliに状態クラスだけ付ける
      li.classList.toggle('completed', cb.checked);
      
      await window.electronAPI.store.set('backlog', backlog);
      // ❌ renderView() しない
    });

    // SVGアイコン
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 200 25');
    svg.setAttribute('class', 'todo__icon');
    svg.innerHTML = `
      <path class="todo__line"  d="M21 12.3h168v0.1z"></path>
      <path class="todo__box"   d="M21 12.7v5c0 1.3-1 2.3-2.3 2.3H8.3C7 20 6 19 6 17.7V7.3C6 6 7 5 8.3 5h10.4C20 5 21 6 21 7.3v5.4"></path>
      <path class="todo__check" d="M10 13l2 2 5-5"></path>
      <circle class="todo__circle" cx="13.5" cy="12.5" r="10"></circle>
    `;

    const lbl = document.createElement('span');
    lbl.textContent = item.description;
    lbl.addEventListener('dblclick', () => {
      const inp = document.createElement('input');
      inp.type  = 'text';
      inp.value = item.description;
      inp.addEventListener('keydown', async e => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          if (e.key === 'Enter') {
            item.description = inp.value.trim() || item.description;
            await window.electronAPI.store.set('backlog', backlog);
          }
          renderView();
        }
      });
      inp.addEventListener('blur', async () => {
        item.description = inp.value.trim() || item.description;
        await window.electronAPI.store.set('backlog', backlog);
        renderView();
      });
      li.replaceChild(inp, lbl);
      inp.focus();
    });

    // 右端：ToDoへ移動ボタン（初期は Other に入る）
    const moveBtn = document.createElement('button');
    moveBtn.className = 'icon-btn move-btn';
    moveBtn.title = 'ToDoへ移動';
    moveBtn.textContent = '📤';
    moveBtn.addEventListener('click', () => moveBacklogToTodo(idx));

    li.append(cb, svg, lbl, moveBtn);
    ul.appendChild(li);
  });
}

//　── ToDo ⇔ Backlog 移動 ──
async function moveTodoToBacklog(todoIndex) {
  const moved = todos.splice(todoIndex, 1)[0];
  if (!moved) return;
  moved.section = undefined;
  moved.status  = 'Backlog';
  backlog.push(moved);
  await window.electronAPI.store.set('todos', todos);
  await window.electronAPI.store.set('backlog', backlog);
  showNotification('ToDo → Backlog に移動しました');
  renderView();
}

// ── Backlog → ToDo 移動 ──
async function moveBacklogToTodo(backlogIndex) {
  const moved = backlog.splice(backlogIndex, 1)[0];
  if (!moved) return;
  moved.section = 'other';  // 初期は Other
  moved.status  = 'ToDo';
  todos.push(moved);
  await window.electronAPI.store.set('todos', todos);
  await window.electronAPI.store.set('backlog', backlog);
  showNotification('Backlog → ToDo に移動しました');
  renderView();
}

// ── ドロップ処理を一度だけ登録 ──
async function handleDropEvent(e, sectionKey) {
  e.preventDefault();
  const srcIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
  if (isNaN(srcIdx)) return;
  const item = todos[srcIdx];
  const count = todos.filter(t => t.section === sectionKey).length;
  if (sectionLimit[sectionKey] < count + (item.section !== sectionKey ? 1 : 0)) {
    showNotification('セクションの上限を超えています');
    return;
  }
  todos.splice(srcIdx, 1);
  item.section = sectionKey;
  todos.push(item);
  await window.electronAPI.store.set('todos', todos);
  renderView();
}

// ── 表示切替 ──
function renderView() {
  // Row2
  document.getElementById('todo-add-container').style.display    = currentView === 'todo'    ? 'flex' : 'none';
  document.getElementById('backlog-add-container').style.display = currentView === 'backlog' ? 'flex' : 'none';
  // Row3
  document.getElementById('todo-view').style.display    = currentView === 'todo'    ? 'flex' : 'none';
  document.getElementById('backlog-view').style.display = currentView === 'backlog' ? 'flex' : 'none';

  if (currentView === 'todo') {
    renderTodoSections();
  } else {
    renderBacklogList();
  }
}

// ── 初期化 ──
window.addEventListener('DOMContentLoaded', async () => {
  todos   = (await window.electronAPI.store.get('todos'))   || [];
  backlog = (await window.electronAPI.store.get('backlog')) || [];
  todos = todos.map(t => ({ section: 'other', status: 'ToDo', ...t }));

  setupAddTask('new-todo-input',    'add-todo-button',    'todos');
  setupAddTask('new-backlog-input', 'add-backlog-button', 'backlog');

  // ドロップ先を一度だけ登録
  const sections = {
    mustone:  document.getElementById('section-mustone-list'),
    medium:   document.getElementById('section-medium-list'),
    small:    document.getElementById('section-small-list'),
    other:    document.getElementById('section-other-list')
  };
  Object.entries(sections).forEach(([key, listEl]) => {
    if (!listEl) return;
    listEl.addEventListener('dragover', e => e.preventDefault());
    listEl.addEventListener('drop', e => handleDropEvent(e, key));
  });

  renderView();
});