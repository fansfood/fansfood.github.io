
const $=id=>document.getElementById(id);
const home=$('homeShell'),workspace=$('appShell');
function showToast(msg){
  const el=$('homeToast'); if(!el)return;
  el.textContent=msg;el.hidden=false;clearTimeout(showToast.t);showToast.t=setTimeout(()=>el.hidden=true,1800);
}
function openWorkspace(mode='live'){
  if(!home||!workspace)return;
  home.hidden=true;workspace.hidden=false;window.scrollTo({top:0,behavior:'instant'});
  setTimeout(()=>{
    if(mode==='courses'||mode==='history') $('historyButton')?.click();
    if(mode==='quick'){
      $('newSession')?.click();
      const t=$('classTitle');if(t){t.value='快速翻译 / Quick Translate';t.dispatchEvent(new Event('input',{bubbles:true}))}
    }
    if(mode==='recordings') document.querySelector('.recordings-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
    if(mode==='account') $('accountButton')?.click();
  },60);
}
function backHome(){
  if($('recordButton')?.classList.contains('stop')) $('recordButton')?.click();
  $('closeHistory')?.click();
  workspace.hidden=true;home.hidden=false;window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',()=>openWorkspace(el.dataset.action)));
document.querySelectorAll('[data-soon]').forEach(el=>el.addEventListener('click',()=>showToast(el.dataset.soon+' · Beta 1.005 后续开放')));
$('backHomeButton')?.addEventListener('click',backHome);
$('homeProfile')?.addEventListener('click',()=>openWorkspace('account'));
window.addEventListener('popstate',()=>{if(!home.hidden) return; backHome()});
