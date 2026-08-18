import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const VERSION = '1.0.016';
const MAIN_KEY = 'shiguang-v2-state';
const SCHEDULE_KEY = 'shiguang-shopping-dates';
const OVERRIDE_KEY = 'shiguang-shopping-overrides';
const REMOVED_KEY = 'shiguang-shopping-removed-v16';
const cfg = window.SHIGUANG_CONFIG || {};
const supabase = cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY
  ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY)
  : null;
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

const LEGACY_PLAN = {
  '周一':{早餐:'r6',午餐:'r1',晚餐:'r2'},
  '周二':{早餐:'r3',午餐:'r5',晚餐:'r4'},
  '周三':{早餐:'r6',午餐:null,晚餐:'r2'},
  '周四':{早餐:'r3',午餐:'r1',晚餐:null},
  '周五':{早餐:'r6',午餐:'r5',晚餐:'r4'},
  '周六':{早餐:null,午餐:null,晚餐:'r1'},
  '周日':{早餐:'r3',午餐:null,晚餐:'r2'}
};
const EMPTY_PLAN = Object.fromEntries(['周一','周二','周三','周四','周五','周六','周日'].map(d => [d,{早餐:null,午餐:null,晚餐:null}]));
const DEMO_ITEMS = [
  {id:'manual:demo:milk',name:'牛奶',qtyText:'1 L',category:'乳制品'},
  {id:'manual:demo:eggs',name:'鸡蛋',qtyText:'10 个',category:'肉蛋'},
  {id:'manual:demo:broccoli',name:'西兰花',qtyText:'1 个',category:'蔬菜'}
];

function toast(msg){const el=$('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(el._bulkT);el._bulkT=setTimeout(()=>el.classList.remove('show'),1800);}
function localDateISO(offset=0){const d=new Date();d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function demoSchedule(){return {version:2,sections:[{id:'demo:tomorrow',date:localDateISO(1)},{id:'demo:dayafter',date:localDateISO(2)}],assignments:{'manual:demo:milk':'demo:tomorrow','manual:demo:eggs':'demo:tomorrow','manual:demo:broccoli':'demo:dayafter'}};}
function readJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
function writeJSON(key,value){localStorage.setItem(key,JSON.stringify(value));}
function stable(v){if(Array.isArray(v))return v.map(stable);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));return v;}
function same(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b));}
function pristineState(row){return same(row?.plan,LEGACY_PLAN)&&(!row?.manual_shopping||row.manual_shopping.length===0)&&(!row?.checked||Object.keys(row.checked).length===0);}
function setVersion(){const b=$('.brand small');if(b)b.textContent=`v${VERSION}`;}

async function migrateDemoIfNeeded(){
  let migrated=false;
  const local=readJSON(MAIN_KEY,{});
  if(same(local?.plan,LEGACY_PLAN)&&(!local?.manualShopping||local.manualShopping.length===0)&&(!local?.checked||Object.keys(local.checked).length===0)){
    local.plan=EMPTY_PLAN;
    local.manualShopping=DEMO_ITEMS;
    local.checked={};
    writeJSON(MAIN_KEY,local);
    writeJSON(SCHEDULE_KEY,demoSchedule());
    migrated=true;
  }
  if(supabase){
    const {data:sessionData}=await supabase.auth.getSession();
    const user=sessionData.session?.user;
    if(user){
      const {data}=await supabase.from('app_state').select('plan,manual_shopping,checked').eq('user_id',user.id).maybeSingle();
      if(pristineState(data)){
        const schedule=demoSchedule();
        await supabase.from('app_state').update({plan:EMPTY_PLAN,manual_shopping:DEMO_ITEMS,checked:{},shopping_dates:schedule,shopping_removed_items:[],updated_at:new Date().toISOString()}).eq('user_id',user.id);
        const latest=readJSON(MAIN_KEY,{});latest.plan=EMPTY_PLAN;latest.manualShopping=DEMO_ITEMS;latest.checked={};writeJSON(MAIN_KEY,latest);writeJSON(SCHEDULE_KEY,schedule);migrated=true;
      }
    }
  }
  if(migrated&&!sessionStorage.getItem('shopping-v16-reloaded')){
    sessionStorage.setItem('shopping-v16-reloaded','1');
    location.reload();
  }
}

function readRemoved(){return new Set(readJSON(REMOVED_KEY,[]));}
function saveRemoved(set){writeJSON(REMOVED_KEY,[...set]);}

function injectStyles(){
  if($('#shoppingBulkV10016Styles'))return;
  const style=document.createElement('style');style.id='shoppingBulkV10016Styles';style.textContent=`
  .shopping-bulk-manage-v16,.shopping-bulk-delete-v16{min-height:31px!important;padding:6px 10px!important;font-size:11px!important;border-radius:10px!important}
  .shopping-bulk-tools-v16{display:none;align-items:center;gap:8px;flex-wrap:wrap}.shopping-date-group.bulk-mode-v16 .shopping-bulk-tools-v16{display:flex}
  .shopping-bulk-selectall-v16{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border:1px solid var(--line);border-radius:9px;background:#fafbf8;font-size:11px;font-weight:700;color:var(--muted);cursor:pointer}
  .shopping-bulk-selectall-v16 input{width:15px;height:15px;margin:0;accent-color:var(--accent)}
  .shopping-delete-select-v16{display:none!important;width:17px!important;height:17px!important;margin:0!important;accent-color:#9a554f;justify-self:end}
  .shopping-date-group.bulk-mode-v16 .shopping-delete-select-v16{display:block!important}
  .shopping-date-group.bulk-mode-v16 .shopping-item{grid-template-columns:24px minmax(0,1fr) auto auto 20px!important}
  .shopping-bulk-delete-v16[disabled]{opacity:.45;cursor:not-allowed}
  @media(max-width:700px){
    .shopping-date-head-actions{width:100%;justify-content:flex-start!important}
    .shopping-date-group.bulk-mode-v16 .shopping-item{grid-template-columns:22px minmax(0,1fr) auto 20px!important}
    .shopping-date-group.bulk-mode-v16 .shopping-item>.icon-btn{display:none!important}
    .shopping-bulk-manage-v16,.shopping-bulk-delete-v16{min-height:36px!important}
  }
  @media(max-width:430px){
    .shopping-date-head-actions{gap:6px!important}
    .shopping-bulk-tools-v16{width:100%;display:none;grid-template-columns:auto 1fr;align-items:center}
    .shopping-date-group.bulk-mode-v16 .shopping-bulk-tools-v16{display:grid}
    .shopping-bulk-delete-v16{width:100%}
    .shopping-date-group.bulk-mode-v16 .shopping-item{grid-template-columns:20px minmax(0,1fr) auto 18px!important}
  }`;
  document.head.appendChild(style);
}

function rowId(row){return $('[data-check]',row)?.dataset.check||row.dataset.shoppingId||'';}
function refreshDeleteButton(card){
  const boxes=$$('.shopping-delete-select-v16',card);const selected=boxes.filter(b=>b.checked).length;
  const del=$('.shopping-bulk-delete-v16',card);if(del){del.disabled=!selected;del.textContent=selected?`删除已选（${selected}）`:'删除已选';}
  const all=$('.shopping-bulk-selectall-v16 input',card);if(all){all.checked=boxes.length>0&&selected===boxes.length;all.indeterminate=selected>0&&selected<boxes.length;}
}
function addBulkControls(card){
  if(card.dataset.bulkV16==='1')return;card.dataset.bulkV16='1';
  const actions=$('.shopping-date-head-actions',card);if(!actions)return;
  const manage=document.createElement('button');manage.type='button';manage.className='btn ghost shopping-bulk-manage-v16';manage.textContent='管理';
  const tools=document.createElement('span');tools.className='shopping-bulk-tools-v16';tools.innerHTML='<label class="shopping-bulk-selectall-v16"><input type="checkbox">全选</label><button class="btn danger shopping-bulk-delete-v16" type="button" disabled>删除已选</button>';
  actions.append(manage,tools);
  const ensureRowBoxes=()=>{$$('.shopping-item',card).forEach(row=>{if($('.shopping-delete-select-v16',row))return;const b=document.createElement('input');b.type='checkbox';b.className='shopping-delete-select-v16';b.setAttribute('aria-label','选择此项用于删除');b.addEventListener('change',()=>refreshDeleteButton(card));row.appendChild(b);});};
  manage.onclick=()=>{card.classList.toggle('bulk-mode-v16');manage.textContent=card.classList.contains('bulk-mode-v16')?'完成':'管理';ensureRowBoxes();refreshDeleteButton(card);};
  $('.shopping-bulk-selectall-v16 input',tools).onchange=e=>{ensureRowBoxes();$$('.shopping-delete-select-v16',card).forEach(b=>b.checked=e.target.checked);refreshDeleteButton(card);};
  $('.shopping-bulk-delete-v16',tools).onclick=()=>deleteSelected(card);
}

async function deleteSelected(card){
  const selected=$$('.shopping-delete-select-v16:checked',card).map(b=>rowId(b.closest('.shopping-item'))).filter(Boolean);
  if(!selected.length)return;
  if(!confirm(`删除选中的 ${selected.length} 项采购吗？`))return;
  const selectedSet=new Set(selected);
  const state=readJSON(MAIN_KEY,{});state.manualShopping=(state.manualShopping||[]).filter(i=>!selectedSet.has(i.id));state.checked=state.checked||{};selected.forEach(id=>delete state.checked[id]);writeJSON(MAIN_KEY,state);
  const schedule=readJSON(SCHEDULE_KEY,{version:2,sections:[],assignments:{}});schedule.assignments=schedule.assignments||{};selected.forEach(id=>delete schedule.assignments[id]);writeJSON(SCHEDULE_KEY,schedule);
  const overrides=readJSON(OVERRIDE_KEY,{});selected.forEach(id=>delete overrides[id]);writeJSON(OVERRIDE_KEY,overrides);
  const removed=readRemoved();selected.filter(id=>id.startsWith('auto:')).forEach(id=>removed.add(id));saveRemoved(removed);
  if(supabase){
    const {data:sessionData}=await supabase.auth.getSession();const user=sessionData.session?.user;
    if(user)await supabase.from('app_state').update({manual_shopping:state.manualShopping||[],checked:state.checked,shopping_dates:schedule,shopping_overrides:overrides,shopping_removed_items:[...removed],updated_at:new Date().toISOString()}).eq('user_id',user.id);
  }
  toast(`已删除 ${selected.length} 项`);setTimeout(()=>location.reload(),250);
}

function applyRemoved(){
  const removed=readRemoved();if(!removed.size)return;
  $$('#shoppingGroups .shopping-item').forEach(row=>{if(removed.has(rowId(row)))row.remove();});
  $$('#shoppingGroups .shopping-date-group').forEach(card=>{
    const rows=$$('.shopping-item',card);const count=$('.shopping-date-count',card);if(count)count.textContent=`${rows.length} 项`;
    const items=$('.shopping-date-items',card);if(items&&!rows.length&&!$('.schedule-empty',items)){items.innerHTML='<div class="schedule-empty">这天暂时没有采购项。</div>';}
  });
}
function enhance(){setVersion();applyRemoved();$$('#shoppingGroups .shopping-date-group').forEach(addBulkControls);}

async function clearRemovedOnRegenerate(){
  saveRemoved(new Set());
  if(supabase){const {data}=await supabase.auth.getSession();const user=data.session?.user;if(user)await supabase.from('app_state').update({shopping_removed_items:[],updated_at:new Date().toISOString()}).eq('user_id',user.id);}
}
async function pullRemoved(){
  if(!supabase)return;const {data:sessionData}=await supabase.auth.getSession();const user=sessionData.session?.user;if(!user)return;
  const {data}=await supabase.from('app_state').select('shopping_removed_items').eq('user_id',user.id).maybeSingle();if(Array.isArray(data?.shopping_removed_items)){saveRemoved(new Set(data.shopping_removed_items));enhance();}
}

function init(){
  injectStyles();setVersion();
  const root=$('#shoppingGroups');if(root)new MutationObserver(()=>setTimeout(enhance,30)).observe(root,{childList:true,subtree:true});
  document.addEventListener('click',e=>{if(e.target?.id==='generateShoppingBtn')clearRemovedOnRegenerate();},true);
  window.addEventListener('hashchange',()=>{setVersion();if(location.hash==='#shopping')setTimeout(enhance,80);});
  window.addEventListener('focus',setVersion);
  setTimeout(()=>{enhance();pullRemoved();migrateDemoIfNeeded();},900);
  if(supabase)supabase.auth.onAuthStateChange(()=>setTimeout(()=>{pullRemoved();migrateDemoIfNeeded();},350));
}
init();
