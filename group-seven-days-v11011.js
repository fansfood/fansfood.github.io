import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg=window.SHIGUANG_CONFIG||{};
const supabase=cfg.SUPABASE_URL&&cfg.SUPABASE_PUBLISHABLE_KEY
  ? createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,storage:window.localStorage}})
  : null;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let timer=null;
let busy=false;
let selectedDate='';
let currentGroupId='';
let currentUser=null;
let membership=null;
let recipes=[];
let items=[];

const SLOT_META={
  breakfast:{label:'早餐',icon:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/>'},
  lunch:{label:'午餐',icon:'<path d="M4 10h16a8 8 0 0 1-16 0Z"/><path d="M8 19h8M7 6c1-2 3-2 4-4M13 7c1-2 3-2 4-4"/>'},
  dinner:{label:'晚餐',icon:'<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>'}
};
function svg(path){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`}
function toast(msg){const el=$('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(el._gmT);el._gmT=setTimeout(()=>el.classList.remove('show'),2200);}
function activeGroup(){return localStorage.getItem('fansfood-active-group')||''}
function localISO(offset=0){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function days7(){
  const weekdays=['周日','周一','周二','周三','周四','周五','周六'];
  return Array.from({length:7},(_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+i);return {date:localISO(i),relative:i===0?'今天':i===1?'明天':i===2?'后天':weekdays[d.getDay()],weekday:weekdays[d.getDay()],md:`${d.getMonth()+1}/${d.getDate()}`};});
}
function canEdit(){return membership?.member_role==='chef'}
function publicImage(path,url){if(url)return url;if(path&&supabase)return supabase.storage.from('dish-images').getPublicUrl(path).data.publicUrl;return ''}

function relabelPersonalSevenDays(){
  const nav=$('#nav a[href="#menu"] span');if(nav)nav.textContent='我的七天';
  const page=$('#menu');
  if(page){
    const title=$('.page-title h1',page);if(title)title.textContent='我的七天';
    const eye=$('.page-title .eyebrow',page);if(eye)eye.textContent='MY 7 DAYS';
    const p=$('.page-title p',page);if(p)p.textContent='这里只安排你自己的未来七天。早餐、午餐、晚餐都可以按自己的节奏来。';
  }
  $$('.wd-section-title h2').forEach(h=>{if(h.textContent.trim()==='近七天菜谱')h.textContent='我的七天';});
  $$('.wd-section-title p').forEach(p=>{if(p.textContent.includes('接下来七天怎么吃'))p.textContent='从今天开始，看看你自己的未来七天怎么吃。';});
  $$('a[href="#menu"]').forEach(a=>{if(a.textContent.includes('查看完整安排'))a.textContent='查看我的七天 →';});
}

function ensureGroupTab(){
  const panel=$('#activeGroupPanel');const tabs=panel?.querySelector('.wd-group-tabs');const grid=panel?.querySelector('.group-content-grid');
  if(!panel||!tabs||!grid)return false;
  if(!tabs.querySelector('[data-wd-tab="groupmenu"]')){
    const btn=document.createElement('button');btn.type='button';btn.dataset.wdTab='groupmenu';btn.textContent='七天菜单';
    const ledger=tabs.querySelector('[data-wd-tab="ledger"]');const shopping=tabs.querySelector('[data-wd-tab="shopping"]');
    (ledger||shopping)?.insertAdjacentElement('beforebegin',btn) || tabs.appendChild(btn);
    btn.addEventListener('click',()=>{
      panel.dataset.wdTab='groupmenu';
      $$('[data-wd-tab]',tabs).forEach(x=>x.classList.toggle('active',x===btn));
      loadAndRender(true);
    });
  }
  if(!$('#groupSevenDayPanel',panel)){
    const section=document.createElement('section');section.id='groupSevenDayPanel';section.innerHTML='<div class="gm-empty"><b>正在读取小饭桌七天菜单…</b></div>';
    const ledger=$('#groupLedgerPanel',panel);const vote=$('.wd-group-vote-link',panel);
    if(ledger)ledger.insertAdjacentElement('beforebegin',section);else if(vote)vote.insertAdjacentElement('afterend',section);else grid.insertAdjacentElement('beforebegin',section);
  }
  return true;
}

async function fetchData(){
  currentGroupId=activeGroup();if(!supabase||!currentGroupId)return false;
  const {data:s}=await supabase.auth.getSession();currentUser=s.session?.user||null;if(!currentUser)return false;
  const from=localISO(0),to=localISO(6);
  const [m,r,i]=await Promise.all([
    supabase.from('group_members').select('group_id,user_id,member_name,member_role').eq('group_id',currentGroupId).eq('user_id',currentUser.id).maybeSingle(),
    supabase.from('group_recipes').select('id,name,description,category,image_path,image_url').eq('group_id',currentGroupId).order('created_at',{ascending:false}),
    supabase.from('group_meal_items').select('id,group_id,meal_date,meal_slot,name,description,source_recipe_id,image_path,image_url,created_by,created_at').eq('group_id',currentGroupId).gte('meal_date',from).lte('meal_date',to).order('meal_date').order('meal_slot').order('created_at')
  ]);
  if(m.error||!m.data)return false;membership=m.data;recipes=r.error?[]:(r.data||[]);items=i.error?[]:(i.data||[]);
  const valid=days7().map(d=>d.date);if(!selectedDate||!valid.includes(selectedDate))selectedDate=valid[0];
  return true;
}

function dayButtonHtml(d){const count=items.filter(x=>x.meal_date===d.date).length;return `<button class="gm-day-btn ${selectedDate===d.date?'active':''} ${count?'has-meal':''}" type="button" data-gm-day="${d.date}"><b>${d.relative}</b><span>${d.md} · ${d.weekday}</span><em>${count?`${count} 道共同安排`:'暂无安排'}</em></button>`}
function itemHtml(item){const img=publicImage(item.image_path,item.image_url);return `<article class="gm-item ${img?'':'no-image'}">${img?`<img src="${esc(img)}" alt="${esc(item.name)}">`:''}<div><h4>${esc(item.name)}</h4>${item.description?`<p>${esc(item.description)}</p>`:''}</div>${canEdit()?`<button class="gm-delete" type="button" data-gm-delete="${item.id}">删除</button>`:''}</article>`}
function slotHtml(slot,date){
  const meta=SLOT_META[slot];const list=items.filter(x=>x.meal_date===date&&x.meal_slot===slot);if(!list.length)return '';
  return `<section class="gm-slot"><div class="gm-slot-head"><div class="gm-slot-title"><span class="gm-slot-icon">${svg(meta.icon)}</span><b>${meta.label}</b></div><span>${list.length} 道</span></div><div class="gm-items">${list.map(itemHtml).join('')}</div></section>`;
}
function selectedDayHtml(){
  const meta=days7().find(d=>d.date===selectedDate)||days7()[0];const dayItems=items.filter(x=>x.meal_date===meta.date);const count=dayItems.length;
  const slots=['breakfast','lunch','dinner'].filter(slot=>dayItems.some(x=>x.meal_slot===slot));
  const body=count?`<div class="gm-meal-list">${slots.map(slot=>slotHtml(slot,meta.date)).join('')}</div>`:`<div class="gm-empty"><b>这天大家各自安排</b><span>没有约好一起吃的饭，就不占用小饭桌菜单。需要时再添加一顿共同用餐。</span></div>`;
  return `<section class="card gm-day-card"><div class="gm-day-card-head"><div><h3>${meta.relative} · ${meta.md}</h3><p>${count?`这一天有 ${count} 道共同用餐安排。`:'这一天没有共同用餐安排。'}</p></div>${canEdit()?'<button class="btn primary" type="button" id="gmAddMeal">＋ 安排一起吃</button>':''}</div>${body}</section>`;
}
function formHtml(){
  if(!canEdit())return '';
  const dayOptions=days7().map(d=>`<option value="${d.date}" ${d.date===selectedDate?'selected':''}>${d.relative} · ${d.md}</option>`).join('');
  const recipeOptions=recipes.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('');
  return `<section class="card gm-form-card" id="gmFormCard"><div class="gm-form-head"><div><span class="eyebrow">SHARED MEAL</span><h3>安排一顿大家一起吃的饭</h3></div><button type="button" id="gmCloseForm">收起</button></div><form class="gm-form" id="gmMealForm"><div class="gm-form-row"><label class="gm-field"><span>哪一天</span><select id="gmDate">${dayOptions}</select></label><label class="gm-field"><span>哪一餐</span><select id="gmSlot"><option value="breakfast">早餐</option><option value="lunch">午餐</option><option value="dinner" selected>晚餐</option></select></label></div><label class="gm-field"><span>从群组菜谱选择（可选）</span><select id="gmRecipe"><option value="">自定义菜名</option>${recipeOptions}</select></label><label class="gm-field"><span>吃什么</span><input id="gmName" maxlength="100" placeholder="例如：番茄炖牛腩" required></label><label class="gm-field"><span>备注（可选）</span><textarea id="gmDescription" maxlength="300" placeholder="例如：周六晚上一起做，4个人"></textarea></label><div class="gm-form-actions"><button class="btn primary" type="submit">加入小饭桌七天菜单</button></div></form></section>`;
}
function render(){
  const root=$('#groupSevenDayPanel');if(!root)return;
  const plannedDays=new Set(items.map(i=>i.meal_date)).size;
  root.innerHTML=`<div class="gm-shell"><section class="card gm-hero"><div class="gm-hero-head"><div><span class="eyebrow">GROUP 7 DAYS</span><h3>小饭桌七天菜单</h3><p>这里只记录大家真正会一起吃的饭。你自己的早餐、午餐、晚餐继续放在外面的“我的七天”，两边互不干扰。</p><span class="gm-hero-note">${svg('<path d="M8 2v4M16 2v4"/><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/>')}未来 7 天有 ${plannedDays} 天安排一起吃</span></div>${canEdit()?'<button class="btn primary" type="button" id="gmHeroAdd">＋ 安排一起吃</button>':''}</div></section><div class="gm-days">${days7().map(dayButtonHtml).join('')}</div>${selectedDayHtml()}${formHtml()}</div>`;
  installHandlers();
}
function openForm(){const form=$('#gmFormCard');if(form){form.classList.add('open');$('#gmDate').value=selectedDate;form.scrollIntoView({behavior:'smooth',block:'nearest'});}}
function installHandlers(){
  $$('[data-gm-day]').forEach(btn=>btn.onclick=()=>{selectedDate=btn.dataset.gmDay;render();});
  $('#gmAddMeal')?.addEventListener('click',openForm);$('#gmHeroAdd')?.addEventListener('click',openForm);$('#gmCloseForm')?.addEventListener('click',()=>$('#gmFormCard')?.classList.remove('open'));
  $('#gmRecipe')?.addEventListener('change',e=>{const r=recipes.find(x=>x.id===e.target.value);if(!r)return;$('#gmName').value=r.name||'';$('#gmDescription').value=r.description||'';});
  $('#gmMealForm')?.addEventListener('submit',saveMeal);
  $$('[data-gm-delete]').forEach(btn=>btn.onclick=()=>deleteMeal(btn.dataset.gmDelete));
}
async function saveMeal(e){
  e.preventDefault();const name=$('#gmName')?.value.trim();const date=$('#gmDate')?.value;const slot=$('#gmSlot')?.value;const recipeId=$('#gmRecipe')?.value||null;if(!name||!date||!slot)return;
  const recipe=recipes.find(r=>r.id===recipeId);const submit=e.submitter;submit.disabled=true;submit.textContent='保存中…';
  const payload={group_id:currentGroupId,meal_date:date,meal_slot:slot,name,description:$('#gmDescription')?.value.trim()||'',source_recipe_id:recipeId,image_path:recipe?.image_path||null,image_url:recipe?.image_url||null,created_by:currentUser.id};
  const {error}=await supabase.from('group_meal_items').insert(payload);submit.disabled=false;submit.textContent='加入小饭桌七天菜单';if(error){toast(error.message||'保存失败');return;}selectedDate=date;toast('已加入小饭桌七天菜单');await loadAndRender(true);
}
async function deleteMeal(id){if(!confirm('删除这道共同用餐安排吗？不会影响任何人的“我的七天”。'))return;const {error}=await supabase.from('group_meal_items').delete().eq('id',id).eq('group_id',currentGroupId);if(error){toast(error.message||'删除失败');return;}toast('已删除共同用餐安排');await loadAndRender(true);}
async function loadAndRender(force=false){if(busy&&!force)return;if(!ensureGroupTab())return;busy=true;try{const ok=await fetchData();const root=$('#groupSevenDayPanel');if(!ok){if(root)root.innerHTML='<div class="gm-empty"><b>暂时无法读取小饭桌菜单</b><span>请确认已经登录并加入这个群组。</span></div>';return;}render();}finally{busy=false;}}

function syncTabVisibility(){
  const panel=$('#activeGroupPanel');if(!panel)return;const tab=panel.dataset.wdTab;
  if(tab!=='groupmenu')return;
  const btn=$('[data-wd-tab="groupmenu"]',panel);$$('[data-wd-tab]',panel).forEach(x=>x.classList.toggle('active',x===btn));
}
function run(){
  relabelPersonalSevenDays();
  if(ensureGroupTab()){syncTabVisibility();if($('#activeGroupPanel')?.dataset.wdTab==='groupmenu')loadAndRender();}
}
function schedule(delay=80){clearTimeout(timer);timer=setTimeout(run,delay)}
function init(){
  schedule(600);schedule(1500);
  new MutationObserver(()=>{if(!busy)schedule(100)}).observe(document.body,{childList:true,subtree:true});
  window.addEventListener('hashchange',()=>schedule(100));
  window.addEventListener('fansfood-group-changed',()=>{selectedDate='';schedule(160)});
  window.addEventListener('fansfood-account-changed',()=>schedule(160));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
