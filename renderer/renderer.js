import Store from 'electron-store';
const store = new Store();

let currentView = 'todo';
let todos = store.get('todos', []);
let backlog = store.get('backlog', []);

// ボタンイベント登録
// ...

async function fetchSprint() {
  const sprintId = prompt('Sprint ID を入力');
  const tasks = await window.electronAPI.fetchSprint(sprintId);
  // 今日のタスクを絞り込んで表示
}

function renderView() {
  // currentView によって todos/backlog を描画
}

function addTodo(item) {
  todos.push(item);
  store.set('todos', todos);
  renderView();
}

async function endOfDay() {
  const changes = { todos, backlog };
  await window.electronAPI.syncToJira(changes);
  const report = await window.electronAPI.generateReport('end', todos);
  alert(report);
  todos = [];
  store.set('todos', todos);
  renderView();
}