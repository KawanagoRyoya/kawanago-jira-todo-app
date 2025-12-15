// renderer/renderer.js

let todos = [];
let backlog = [];
let currentView = 'todo';
let draggingElement = null;

const sectionLimit = {
  mustone: 1,
  medium:  3,
  small:   5,
  other:  Infinity
};

// Toast通知システム
const MAX_TOASTS = 3;
const TOAST_AUTO_DISMISS_MS = 3000;
const TOAST_ANIMATION_DURATION_MS = 500; // 500ms matches the 0.5s transition duration in .toast.removing CSS class
let toastQueue = [];
const toastTimeouts = new WeakMap();

function showNotification(msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  // 最大数を超えたら一番古いToastを削除
  if (toastQueue.length >= MAX_TOASTS) {
    const oldestToast = toastQueue.shift();
    removeToast(oldestToast);
  }
  
  // Toast要素を作成
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  const message = document.createElement('span');
  message.className = 'toast-message';
  message.textContent = msg;
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.innerHTML = '×';
  closeBtn.addEventListener('click', () => removeToast(toast));
  
  toast.appendChild(message);
  toast.appendChild(closeBtn);
  container.appendChild(toast);
  
  // キューに追加
  toastQueue.push(toast);
  
  // アニメーションで表示
  setTimeout(() => toast.classList.add('show'), 10);
  
  // 3秒後に自動削除（タイムアウトIDを保存）
  const timeoutId = setTimeout(() => removeToast(toast), TOAST_AUTO_DISMISS_MS);
  toastTimeouts.set(toast, timeoutId);
}

function removeToast(toast) {
  if (!toast || !toast.parentElement) return;
  
  // 自動削除タイムアウトをクリア
  const timeoutId = toastTimeouts.get(toast);
  if (timeoutId) {
    clearTimeout(timeoutId);
    toastTimeouts.delete(toast);
  }
  
  // フェードアウトアニメーション
  toast.classList.add('removing');
  
  // アニメーション終了後にDOMから削除
  setTimeout(() => {
    if (toast.parentElement) {
      toast.parentElement.removeChild(toast);
    }
    // キューから削除
    const index = toastQueue.indexOf(toast);
    if (index > -1) {
      toastQueue.splice(index, 1);
    }
  }, TOAST_ANIMATION_DURATION_MS); // CSSのtransition時間と同じ
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

// btn-fetchはボタンとして残すが、何もしない
// (将来的な機能追加のために保留)
document.getElementById('btn-fetch').addEventListener('click', () => {
  showNotification('近日公開予定です');
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
  
  // セクション名のマッピング
  const sectionNames = {
    mustone: 'MustOne',
    medium: 'Medium',
    small: 'Small',
    other: 'Other'
  };
  
  // 特定のセクションにタスクを追加する関数
  async function addTaskToSection(targetSection) {
    const desc = inputEl.value.trim();
    if (!desc) return;
    
    // セクションの上限チェック
    if (targetSection && targetSection !== 'other') {
      const currentCount = todos.filter(t => t.section === targetSection).length;
      if (currentCount >= sectionLimit[targetSection]) {
        showNotification(`${sectionNames[targetSection]}セクションの上限を超えています`);
        return;
      }
    }
    
    const item = {
      description: desc,
      dueDate:     null,
      status:      'ToDo',
      section:     listName === 'todos' ? (targetSection || 'other') : undefined
    };
    
    if (listName === 'todos') {
      todos.push(item);
      await window.electronAPI.store.set('todos', todos);
      showNotification(`タスクを${sectionNames[targetSection] || 'Other'}に追加しました`);
    } else {
      backlog.push(item);
      await window.electronAPI.store.set('backlog', backlog);
    }
    inputEl.value = '';
    renderView();
  }
  
  // デフォルトのタスク追加（Otherセクション）
  async function addTask() {
    await addTaskToSection('other');
  }
  
  buttonEl.addEventListener('click', addTask);
  
  // キーボードショートカット用の状態（各入力フィールドごとに独立）
  let waitingForEnter = false; // 数字キー後のEnter待機状態
  let pendingSection = null;   // 保留中のセクション
  const SHORTCUT_TIMEOUT_MS = 2000; // ショートカット入力のタイムアウト時間(ミリ秒)
  
  // タイムアウト処理のヘルパー関数
  function clearPendingAfterTimeout(expectedSection) {
    setTimeout(() => {
      if (pendingSection === expectedSection) {
        waitingForEnter = false;
        pendingSection = null;
      }
    }, SHORTCUT_TIMEOUT_MS);
  }
  
  inputEl.addEventListener('keydown', async e => {
    // Ctrl+数字の後のEnter処理
    if (waitingForEnter && e.key === 'Enter') {
      e.preventDefault();
      waitingForEnter = false;
      if (pendingSection) {
        await addTaskToSection(pendingSection);
        pendingSection = null;
      }
      return;
    }
    
    // Ctrl+Enter: Otherセクションに追加
    if (e.ctrlKey && e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await addTask();
      return;
    }
    
    // ToDo画面でのセクション別ショートカット
    if (listName === 'todos') {
      // Ctrl+1: MustOneセクションへの追加を予約
      if (e.ctrlKey && e.key === '1') {
        e.preventDefault();
        waitingForEnter = true;
        pendingSection = 'mustone';
        clearPendingAfterTimeout('mustone');
        return;
      }
      // Ctrl+2: Mediumセクションへの追加を予約
      else if (e.ctrlKey && e.key === '2') {
        e.preventDefault();
        waitingForEnter = true;
        pendingSection = 'medium';
        clearPendingAfterTimeout('medium');
        return;
      }
      // Ctrl+3: Smallセクションへの追加を予約
      else if (e.ctrlKey && e.key === '3') {
        e.preventDefault();
        waitingForEnter = true;
        pendingSection = 'small';
        clearPendingAfterTimeout('small');
        return;
      }
    }
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
      
      // DOMを消さずにliに状態クラスだけ付ける
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
      draggingElement = li;
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      draggingElement = null;
    });
    
    // li自体にドラッグオーバーとドロップを設定
    li.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
      if (!draggingElement || draggingElement === li) return;
      
      // ドロップ位置を視覚的に表示
      const rect = li.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        li.style.borderTop = '2px solid #5B9BD5';
        li.style.borderBottom = '';
      } else {
        li.style.borderTop = '';
        li.style.borderBottom = '2px solid #5B9BD5';
      }
    });
    
    li.addEventListener('dragleave', e => {
      e.preventDefault();
      // Only clear borders if mouse has actually left the li and its children
      if (!e.currentTarget.contains(e.relatedTarget)) {
        li.style.borderTop = '';
        li.style.borderBottom = '';
      }
    });
    
    li.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      li.style.borderTop = '';
      li.style.borderBottom = '';
      
      const srcIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (isNaN(srcIdx) || srcIdx === idx) return;
      
      handleDropOnItem(e, srcIdx, idx, item.section);
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
      
      // DOMを消さずにliに状態クラスだけ付ける
      li.classList.toggle('completed', cb.checked);
      
      await window.electronAPI.store.set('backlog', backlog);
      
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

// ── ドロップ処理（アイテム上） ──
async function handleDropOnItem(e, srcIdx, targetIdx, targetSection) {
  const item = todos[srcIdx];
  const targetItem = todos[targetIdx];
  
  // セクションの上限チェック
  if (item.section !== targetSection) {
    const count = todos.filter(t => t.section === targetSection).length;
    if (sectionLimit[targetSection] < count + 1) {
      showNotification('セクションの上限を超えています');
      return;
    }
  }
  
  // ドロップ位置を決定（上半分か下半分か）
  const rect = e.target.closest('li').getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  const insertBefore = e.clientY < midY;
  
  // ソースアイテムを削除
  todos.splice(srcIdx, 1);
  
  // ターゲットインデックスを再計算（削除後）
  let newTargetIdx = todos.findIndex(t => t === targetItem);
  
  // 挿入位置を決定
  const insertIdx = insertBefore ? newTargetIdx : newTargetIdx + 1;
  
  // セクションを更新
  item.section = targetSection;
  
  // 指定位置に挿入
  todos.splice(insertIdx, 0, item);
  
  await window.electronAPI.store.set('todos', todos);
  renderView();
}

// ── ドロップ処理（空のセクション用） ──
async function handleDropEvent(e, sectionKey) {
  e.preventDefault();
  const srcIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
  if (isNaN(srcIdx)) return;
  
  const item = todos[srcIdx];
  
  // 同じセクションの場合は何もしない（アイテム間のドロップで処理される）
  if (item.section === sectionKey) return;
  
  // セクションの上限チェックと最後のアイテムのインデックスを一度に取得
  let count = 0;
  let lastIdx = -1;
  for (let i = 0; i < todos.length; i++) {
    if (todos[i].section === sectionKey) {
      count++;
      lastIdx = i;
    }
  }
  
  if (sectionLimit[sectionKey] < count + 1) {
    showNotification('セクションの上限を超えています');
    return;
  }
  
  // ソースアイテムを削除
  todos.splice(srcIdx, 1);
  
  // セクションを更新
  item.section = sectionKey;
  
  // セクションの最後に追加
  // srcIdx での削除後、lastIdx の位置が変わる場合があるため調整が必要
  let insertIdx;
  if (lastIdx < 0) {
    // セクションが空の場合は配列の最後に追加
    insertIdx = todos.length;
  } else if (lastIdx >= srcIdx) {
    // 削除により lastIdx の項目が左にシフトするため、insertIdx = lastIdx
    insertIdx = lastIdx;
  } else {
    // lastIdx の位置は変わらないため、insertIdx = lastIdx + 1
    insertIdx = lastIdx + 1;
  }
  
  todos.splice(insertIdx, 0, item);
  
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