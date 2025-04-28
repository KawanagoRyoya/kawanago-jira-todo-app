let todos = window.electronAPI.store.get('todos') || [];
let backlog = window.electronAPI.store.get('backlog') || [];
let currentView = 'todo';
const notification = document.getElementById('notification');
function showNotification(msg){notification.textContent=msg;notification.style.display='block';setTimeout(()=>notification.style.display='none',5000);}

document.getElementById('btn-todo').addEventListener('click',()=>{currentView='todo';renderView();});
document.getElementById('btn-backlog').addEventListener('click',()=>{currentView='backlog';renderView();});

// 手動Sprint ID入力
document.getElementById('btn-fetch').addEventListener('click',()=>{
  document.getElementById('sprint-input-area').style.display='block';
});

document.getElementById('sprint-submit').addEventListener('click',async()=>{
  const sprintId=document.getElementById('sprint-id-input').value;
  if(!sprintId)return;
  document.getElementById('sprint-input-area').style.display='none';
  try{
    const issues=await window.electronAPI.fetchSprint(sprintId);
    todos=issues.map(i=>({issueId:i.key,description:i.fields.summary,dueDate:i.fields.duedate,status:'ToDo'}));
    window.electronAPI.store.set('todos',todos);
    renderView();
  }catch(err){console.error(err);showNotification('スプリント取得に失敗しました:'+err.message);}  
});

// 始業報告
async function reportStart(){
  try{alert(await window.electronAPI.generateReport('start',todos));}
  catch(err){console.error(err);showNotification('始業報告失敗:'+err.message);} }
document.getElementById('btn-report-start').addEventListener('click',reportStart);

// 終業処理
async function endOfDay(){
  try{
    await window.electronAPI.syncToJira({todos,backlog});
    alert(await window.electronAPI.generateReport('end',todos));
    todos=[];
    window.electronAPI.store.set('todos',todos);
    renderView();
  }catch(err){console.error(err);showNotification('終業処理失敗:'+err.message);} }
document.getElementById('btn-report-end').addEventListener('click',endOfDay);

function renderView(){
  const c=document.getElementById('view-container');c.innerHTML='';
  (currentView==='todo'?todos:backlog).forEach(item=>{
    const d=document.createElement('div');d.textContent=`${item.description} (期限:${item.dueDate})`;c.appendChild(d);
  });
}