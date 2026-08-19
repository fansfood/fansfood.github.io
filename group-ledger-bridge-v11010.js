const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
let timer=null;
function openLedgerFromShopping(){
  const panel=$('#activeGroupPanel');const tab=panel?.querySelector('[data-wd-tab="ledger"]');
  if(!panel||!tab)return;
  tab.click();
  setTimeout(()=>{
    const card=$('#aaExpenseFormCard');card?.classList.add('open');
    const note=$('#aaNote');if(note&&!note.value)note.value='群组采购';
    $('#aaAmount')?.focus();
  },180);
}
function enhance(){
  const panel=$('#activeGroupPanel');if(!panel)return;
  $$('.group-module',panel).forEach(module=>{
    const title=$('.module-head h3',module)?.textContent||'';
    if(!title.includes('采购')||module.querySelector('.aa-shopping-bridge'))return;
    const head=$('.module-head',module);if(!head)return;
    const btn=document.createElement('button');btn.type='button';btn.className='text-button aa-shopping-bridge';btn.textContent='记到 AA';btn.onclick=openLedgerFromShopping;head.appendChild(btn);
  });
}
function schedule(){clearTimeout(timer);timer=setTimeout(enhance,100)}
function init(){schedule();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});window.addEventListener('fansfood-group-changed',schedule);window.addEventListener('hashchange',schedule);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
