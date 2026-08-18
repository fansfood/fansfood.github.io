import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const MAIN_KEY='shiguang-v2-state';
const SCHEDULE_KEY='shiguang-shopping-dates';
const OVERRIDE_KEY='shiguang-shopping-overrides';
const REMOVED_KEY='shiguang-shopping-removed-v16';
const cfg=window.SHIGUANG_CONFIG||{};
const supabase=cfg.SUPABASE_URL&&cfg.SUPABASE_PUBLISHABLE_KEY
  ? createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY)
  : null;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
let applying=false;

function toast(msg){const el=$('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(el._bulkNewT);el._bulkNewT=setTimeout(()=>el.classList.remove('show'),1800);}
function readJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function writeJSON(key,value){localStorage.setItem(key,JSON.stringify(value))}
function rowId(row){return $('[data-check]',row)?.dataset.check||row.dataset.shoppingId||''}
function readRemoved(){return new Set(readJSON(REMOVED_KEY,[]))}
function saveRemoved(set){writeJSON(REMOVED_KEY,[...set])}

function cleanLegacyDemoLocal(){
  let changed=false;
  const state=readJSON(MAIN_KEY,{});
  if(Array.isArray(state.manualShopping)){
    const next=state.manualShopping.filter(i=>!String(i?.id||'').startsWith('manual:demo:'));
    if(next.length!==state.manualShopping.length){state.manualShopping=next;changed=true;}
  }
  const schedule=readJSON(SCHEDULE_KEY,{version:2,sections:[],assignments:{}});
  const sections=(schedule.sections||[]).filter(s=>!String(s?.id||'').startsWith('demo:'));
  const valid=new Set(sections.map(s=>s.id));
  const assignments={};
  Object.entries(schedule.assignments||{}).forEach(([id,section])=>{
    if(String(id).startsWith('manual:demo:'))return;
    if(valid.has(section))assignments[id]=section;
  });
  if(sections.length!==(schedule.sections||[]).length||Object.keys(assignments).length!==Object.keys(schedule.assignments||{}).length){
    writeJSON(SCHEDULE_KEY,{version:2,sections,assignments});changed=true;
  }
  if(changed)writeJSON(MAIN_KEY,state);
  return changed;
}

async function cleanLegacyDemoCloud(){
  if(!supabase)return false;
  const {data:sessionData}=await supabase.auth.getSession();const user=sessionData.session?.user;if(!user)return false;
  const {data,error}=await supabase.from('app_state').select('manual_shopping,shopping_dates').eq('user_id',user.id).maybeSingle();if(error||!data)return false;
  const manual=Array.isArray(data.manual_shopping)?data.manual_shopping:[];
  const nextManual=manual.filter(i=>!String(i?.id||'').startsWith('manual:demo:'));
  const raw=data.shopping_dates&&typeof data.shopping_dates==='object'?data.shopping_dates:{version:2,sections:[],assignments:{}};
  const sections=(raw.sections||[]).filter(s=>!String(s?.id||'').startsWith('demo:'));
  const valid=new Set(sections.map(s=>s.id));const assignments={};
  Object.entries(raw.assignments||{}).forEach(([id,section])=>{if(!String(id).startsWith('manual:demo:')&&valid.has(section))assignments[id]=section;});
  const changed=nextManual.length!==manual.length||sections.length!==(raw.sections||[]).length||Object.keys(assignments).length!==Object.keys(raw.assignments||{}).length;
  if(!changed)return false;
  await supabase.from('app_state').update({manual_shopping:nextManual,shopping_dates:{version:2,sections,assignments},updated_at:new Date().toISOString()}).eq('user_id',user.id);
  const local=readJSON(MAIN_KEY,{});local.manualShopping=nextManual;writeJSON(MAIN_KEY,local);writeJSON(SCHEDULE_KEY,{version:2,sections,assignments});
  return true;
}

function refreshDeleteButton(card){
  const boxes=$$('.shopping-delete-select-v11009',card);const selected=boxes.filter(b=>b.checked).length;
  const del=$('.shopping-bulk-delete-v11009',card);if(del){del.disabled=!selected;del.textContent=selected?`删除已选（${selected}）`:'删除已选';}
  const all=$('.shopping-bulk-selectall-v11009 input',card);if(all){all.checked=boxes.length>0&&selected===boxes.length;all.indeterminate=selected>0&&selected<boxes.length;}
}
function setManageMode(card,on){
  card.dataset.bulkMode=on?'1':'0';
  $$('.shopping-delete-select-v11009',card).forEach(b=>{b.hidden=!on;if(!on)b.checked=false;});
  const tools=$('.shopping-bulk-tools-v11009',card);if(tools)tools.hidden=!on;
  const manage=$('.shopping-bulk-manage-v11009',card);if(manage)manage.textContent=on?'完成':'管理';
  refreshDeleteButton(card);
}
function ensureRowBoxes(card){
  $$('.shopping-item',card).forEach(row=>{
    if($('.shopping-delete-select-v11009',row))return;
    const box=document.createElement('input');box.type='checkbox';box.hidden=true;box.className='shopping-delete-select-v11009';box.setAttribute('aria-label','选择此项用于删除');box.addEventListener('change',()=>refreshDeleteButton(card));row.appendChild(box);
  });
}
function addBulkControls(card){
  if(card.dataset.bulkV11009==='1')return;const actions=$('.shopping-date-head-actions',card);if(!actions)return;
  card.dataset.bulkV11009='1';ensureRowBoxes(card);
  const manage=document.createElement('button');manage.type='button';manage.className='btn ghost shopping-bulk-manage-v11009';manage.textContent='管理';
  const tools=document.createElement('span');tools.className='shopping-bulk-tools-v11009';tools.hidden=true;tools.innerHTML='<label class="shopping-bulk-selectall-v11009"><input type="checkbox">全选</label><button class="btn danger shopping-bulk-delete-v11009" type="button" disabled>删除已选</button>';
  actions.append(manage,tools);
  manage.onclick=()=>setManageMode(card,card.dataset.bulkMode!=='1');
  $('.shopping-bulk-selectall-v11009 input',tools).onchange=e=>{ensureRowBoxes(card);$$('.shopping-delete-select-v11009',card).forEach(b=>b.checked=e.target.checked);refreshDeleteButton(card);};
  $('.shopping-bulk-delete-v11009',tools).onclick=()=>deleteSelected(card);
}

async function deleteSelected(card){
  const selected=$$('.shopping-delete-select-v11009:checked',card).map(b=>rowId(b.closest('.shopping-item'))).filter(Boolean);if(!selected.length)return;
  if(!confirm(`删除选中的 ${selected.length} 项采购吗？`))return;
  const set=new Set(selected);const state=readJSON(MAIN_KEY,{});state.manualShopping=(state.manualShopping||[]).filter(i=>!set.has(i.id));state.checked=state.checked||{};selected.forEach(id=>delete state.checked[id]);writeJSON(MAIN_KEY,state);
  const schedule=readJSON(SCHEDULE_KEY,{version:2,sections:[],assignments:{}});schedule.assignments=schedule.assignments||{};selected.forEach(id=>delete schedule.assignments[id]);writeJSON(SCHEDULE_KEY,schedule);
  const overrides=readJSON(OVERRIDE_KEY,{});selected.forEach(id=>delete overrides[id]);writeJSON(OVERRIDE_KEY,overrides);
  const removed=readRemoved();selected.filter(id=>id.startsWith('auto:')).forEach(id=>removed.add(id));saveRemoved(removed);
  if(supabase){const {data}=await supabase.auth.getSession();const user=data.session?.user;if(user)await supabase.from('app_state').update({manual_shopping:state.manualShopping||[],checked:state.checked,shopping_dates:schedule,shopping_overrides:overrides,shopping_removed_items:[...removed],updated_at:new Date().toISOString()}).eq('user_id',user.id);}
  toast(`已删除 ${selected.length} 项`);setTimeout(()=>location.reload(),240);
}

function applyRemoved(){
  const removed=readRemoved();if(!removed.size)return;
  $$('#shoppingGroups .shopping-item').forEach(row=>{if(removed.has(rowId(row)))row.remove();});
  $$('#shoppingGroups .shopping-date-group').forEach(card=>{const rows=$$('.shopping-item',card);const count=$('.shopping-date-count',card);if(count)count.textContent=`${rows.length} 项`;const items=$('.shopping-date-items',card);if(items&&!rows.length&&!$('.schedule-empty',items))items.innerHTML='<div class="schedule-empty">这天暂时没有采购项。</div>';});
}
function enhance(){if(applying)return;applying=true;try{applyRemoved();$$('#shoppingGroups .shopping-date-group').forEach(addBulkControls);}finally{applying=false;}}
async function pullRemoved(){if(!supabase)return;const {data:sessionData}=await supabase.auth.getSession();const user=sessionData.session?.user;if(!user)return;const {data}=await supabase.from('app_state').select('shopping_removed_items').eq('user_id',user.id).maybeSingle();if(Array.isArray(data?.shopping_removed_items)){saveRemoved(new Set(data.shopping_removed_items));enhance();}}
async function clearRemovedOnRegenerate(){saveRemoved(new Set());if(!supabase)return;const {data}=await supabase.auth.getSession();const user=data.session?.user;if(user)await supabase.from('app_state').update({shopping_removed_items:[],updated_at:new Date().toISOString()}).eq('user_id',user.id);}

async function cleanupDemo(){const localChanged=cleanLegacyDemoLocal();const cloudChanged=await cleanLegacyDemoCloud();if((localChanged||cloudChanged)&&!sessionStorage.getItem('wd-demo-cleaned')){sessionStorage.setItem('wd-demo-cleaned','1');toast('已移除旧版演示采购数据');setTimeout(()=>location.reload(),300);}}
function init(){
  const root=$('#shoppingGroups');if(root)new MutationObserver(()=>setTimeout(enhance,30)).observe(root,{childList:true,subtree:true});
  document.addEventListener('click',e=>{if(e.target?.id==='generateShoppingBtn')clearRemovedOnRegenerate();},true);
  window.addEventListener('hashchange',()=>{if(location.hash==='#shopping')setTimeout(enhance,80);});
  setTimeout(()=>{enhance();pullRemoved();cleanupDemo();},850);
  if(supabase)supabase.auth.onAuthStateChange(()=>setTimeout(()=>{pullRemoved();cleanupDemo();},300));
}
init();
