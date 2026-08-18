import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const VERSION = '1.0.013';
const cfg = window.SHIGUANG_CONFIG || {};
const supabase = cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY
  ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY)
  : null;
const ACTIVE_KEY = 'shiguang-food-buddy-active';
const MEALS = [
  ['breakfast','早餐','🌤️'],['lunch','午餐','🍚'],['dinner','晚餐','🌙'],['snack','加餐','🍎']
];
const REACTIONS = ['❤️','😋','💪','👏'];
let sessionUser = null;
let spaces = [];
let activeSpace = null;
let members = [];
let logs = [];
let reactions = [];
let loading = false;

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function toast(msg){const el=$('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(el._buddyT);el._buddyT=setTimeout(()=>el.classList.remove('show'),1900);}
function todayISO(){const d=new Date();const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;}
function setVersion(){const el=$('.brand small');if(el)el.textContent=`v${VERSION}`;}
function mealValue(log,key){const v=log?.meals?.[key];if(Array.isArray(v)) return v[0]||{};return v||{};}

function injectStyles(){
  if($('#foodBuddyV10013Styles')) return;
  const style=document.createElement('style');
  style.id='foodBuddyV10013Styles';
  style.textContent=`
  .buddy-home-strip{grid-column:1/-1;display:flex;align-items:center;gap:14px;min-height:92px;padding:17px 20px!important;background:linear-gradient(100deg,#f7f2ff,#fff)!important}
  .buddy-home-strip .home-module-icon{flex:none}.buddy-home-strip .home-module-copy{margin:0!important;padding:0!important;display:flex;align-items:center;gap:13px;flex:1}.buddy-home-strip .home-module-copy h2{margin:0!important}.buddy-home-strip .home-module-copy p{margin:2px 0 0!important;padding:0!important}.buddy-home-strip .buddy-strip-copy{min-width:0}
  .buddy-shell{display:grid;gap:16px}.buddy-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:15px 17px}.buddy-toolbar-left,.buddy-toolbar-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.buddy-space-select{min-width:170px;border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:#fff;color:var(--ink)}
  .buddy-code{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:999px;background:#f3f5f0;color:var(--muted);font-size:11px}.buddy-code b{color:var(--ink);letter-spacing:1px}.buddy-member-count{font-size:11px;color:var(--muted)}
  .buddy-setup-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.buddy-setup-card{padding:22px}.buddy-setup-card h3{margin:7px 0 7px}.buddy-inline-form{display:flex;gap:8px;margin-top:14px}.buddy-inline-form input{flex:1;min-width:0;border:1px solid var(--line);border-radius:12px;padding:11px 12px;background:#fbfcf9}
  .buddy-checkin{padding:20px}.buddy-checkin-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px}.buddy-checkin-head h2{margin:4px 0 3px}.buddy-date-pill{padding:7px 10px;border-radius:999px;background:#f3f5f0;color:var(--muted);font-size:11px;font-weight:800}
  .buddy-meal-editor{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.buddy-meal-row{display:grid;grid-template-columns:66px minmax(0,1fr) 110px;gap:7px;align-items:center;padding:9px;border:1px solid var(--line);border-radius:14px;background:#fbfcf9}.buddy-meal-row label{font-size:12px;font-weight:800}.buddy-meal-row input{min-width:0;border:0;background:#fff;padding:9px 10px;border-radius:9px;outline:none}.buddy-meal-row input:last-child{text-align:right}
  .buddy-fitness-row{display:grid;grid-template-columns:auto 1fr 130px 92px;gap:8px;align-items:center;margin-top:12px;padding:12px;border:1px dashed var(--line);border-radius:14px}.buddy-fitness-row label{display:flex;align-items:center;gap:7px;font-weight:800;font-size:12px}.buddy-fitness-row select,.buddy-fitness-row input{border:1px solid var(--line);border-radius:10px;padding:9px;background:#fff;min-width:0}.buddy-note{width:100%;margin-top:10px;border:1px solid var(--line);border-radius:12px;padding:11px;background:#fbfcf9;resize:vertical}.buddy-save-row{display:flex;justify-content:flex-end;margin-top:12px}
  .buddy-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-top:6px}.buddy-section-head h2{margin:4px 0 0}.buddy-people-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.buddy-person{padding:17px}.buddy-person.me{border-color:#ccd9c5}.buddy-person-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.buddy-person-name{display:flex;align-items:center;gap:9px}.buddy-avatar{display:grid;place-items:center;width:39px;height:39px;border-radius:50%;background:#f1f4ed;font-size:18px}.buddy-person-name h3{margin:0}.buddy-person-name small{color:var(--muted)}.buddy-status-pill{font-size:10px;padding:5px 8px;border-radius:999px;background:#f3f5f0;color:var(--muted)}
  .buddy-meal-list{display:grid;gap:6px;margin-top:13px}.buddy-meal-item{display:grid;grid-template-columns:64px 1fr auto;gap:8px;align-items:center;padding:8px 9px;border-radius:11px;background:#fafbf8;font-size:12px}.buddy-meal-item span:first-child{color:var(--muted);font-weight:800}.buddy-meal-item b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.buddy-meal-item em{font-style:normal;color:var(--muted);white-space:nowrap}.buddy-fitness-summary{margin-top:9px;padding:9px 10px;border-radius:11px;background:#f7f4ef;font-size:12px}.buddy-note-view{margin:8px 0 0;color:var(--muted);font-size:11px;line-height:1.55}.buddy-reactions{display:flex;gap:6px;flex-wrap:wrap;margin-top:11px}.buddy-react{border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 9px;font-size:12px}.buddy-react.mine{background:#f3f6ef;border-color:#cfd9c9}
  .buddy-empty{padding:30px;text-align:center;color:var(--muted)}.buddy-empty h3{color:var(--ink)}
  @media(max-width:760px){.buddy-setup-grid,.buddy-people-grid,.buddy-meal-editor{grid-template-columns:1fr}.buddy-fitness-row{grid-template-columns:1fr 1fr}.buddy-fitness-row label{grid-column:1/-1}.buddy-toolbar{align-items:flex-start}.buddy-toolbar-actions{width:100%}.buddy-toolbar-actions .btn{flex:1}.buddy-home-strip{min-height:104px}.buddy-home-strip .home-module-copy{align-items:flex-start;flex-direction:column;gap:2px}.buddy-meal-row{grid-template-columns:58px minmax(0,1fr) 92px}}
  @media(max-width:430px){.buddy-meal-row{grid-template-columns:54px minmax(0,1fr) 78px;gap:5px;padding:7px}.buddy-meal-row input{padding:8px 7px}.buddy-person{padding:14px}.buddy-home-strip{padding:15px!important}}
  `;
  document.head.appendChild(style);
}

function ensurePage(){
  let page=$('#buddies');
  if(!page){
    page=document.createElement('section');
    page.className='page';page.id='buddies';
    page.innerHTML=`<div class="page-title"><div><span class="eyebrow">FOOD BUDDIES</span><h1>饭搭子</h1><p>最多 5 位好朋友的小圈子。每天记下吃了什么、吃了多少，以及今天有没有运动。</p></div></div><div id="buddyContent"></div>`;
    $('main')?.appendChild(page);
  }
  const nav=$('#nav');
  if(nav&&!nav.querySelector('a[href="#buddies"]')){
    const a=document.createElement('a');a.href='#buddies';a.textContent='饭搭子';
    const groups=nav.querySelector('a[href="#groups"]');groups?.insertAdjacentElement('afterend',a);
  }
}

function ensureHomeStrip(){
  const grid=$('#home .home-module-grid');if(!grid||grid.querySelector('.buddy-home-strip'))return;
  const a=document.createElement('a');a.href='#buddies';a.className='home-module-card buddy-home-strip';
  a.innerHTML=`<span class="home-module-icon">👫</span><div class="home-module-copy"><div class="buddy-strip-copy"><small>FOOD BUDDIES</small><h2>饭搭子</h2><p>最多 5 位好友，每天一起打卡吃了什么、吃了多少、有没有健身。</p></div></div><span class="home-module-badge">朋友打卡</span><span class="home-module-arrow">→</span>`;
  const third=grid.children[2];third?grid.insertBefore(a,third):grid.appendChild(a);
}

async function loadSession(){
  if(!supabase){sessionUser=null;return;}
  const {data}=await supabase.auth.getSession();sessionUser=data.session?.user||null;
}
async function loadSpaces(){
  spaces=[];activeSpace=null;if(!sessionUser||!supabase)return;
  const {data,error}=await supabase.from('food_buddy_spaces').select('id,name,invite_code,owner_id,created_at').order('created_at',{ascending:true});
  if(error){console.warn(error);return;}
  spaces=data||[];
  const saved=localStorage.getItem(ACTIVE_KEY);
  activeSpace=spaces.find(s=>s.id===saved)||spaces[0]||null;
  if(activeSpace)localStorage.setItem(ACTIVE_KEY,activeSpace.id);
}
async function loadActiveData(){
  members=[];logs=[];reactions=[];if(!activeSpace||!supabase)return;
  const date=todayISO();
  const [m,l,r]=await Promise.all([
    supabase.from('food_buddy_members').select('space_id,user_id,display_name,joined_at').eq('space_id',activeSpace.id).order('joined_at'),
    supabase.from('food_buddy_daily_logs').select('id,space_id,user_id,log_date,meals,fitness_done,fitness_type,fitness_minutes,note,updated_at').eq('space_id',activeSpace.id).eq('log_date',date),
    supabase.from('food_buddy_reactions').select('id,space_id,log_date,target_user_id,reactor_user_id,emoji').eq('space_id',activeSpace.id).eq('log_date',date)
  ]);
  members=m.data||[];logs=l.data||[];reactions=r.data||[];
}

function setupHtml(){
  return `<div class="buddy-setup-grid">
    <section class="card buddy-setup-card"><span class="eyebrow">CREATE</span><h3>新建一个饭搭子</h3><p class="meal-meta">你会成为创建者。把邀请码发给朋友，最多加入 5 人。</p><form class="buddy-inline-form" id="buddyCreateForm"><input name="name" maxlength="40" placeholder="名字，可不填（默认：饭搭子）"><button class="btn primary">创建</button></form></section>
    <section class="card buddy-setup-card"><span class="eyebrow">JOIN</span><h3>加入朋友的饭搭子</h3><p class="meal-meta">输入朋友发来的 8 位邀请码。</p><form class="buddy-inline-form" id="buddyJoinForm"><input name="code" maxlength="8" required placeholder="例如 A1B2C3D4" autocapitalize="characters"><button class="btn primary">加入</button></form></section>
  </div>`;
}

function toolbarHtml(){
  return `<section class="card buddy-toolbar"><div class="buddy-toolbar-left"><select class="buddy-space-select" id="buddySpaceSelect">${spaces.map(s=>`<option value="${s.id}" ${s.id===activeSpace?.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select><span class="buddy-member-count">${members.length}/5 人</span>${activeSpace?`<span class="buddy-code">邀请码 <b>${esc(activeSpace.invite_code)}</b></span>`:''}</div><div class="buddy-toolbar-actions"><button class="btn ghost" id="buddyNewBtn" type="button">＋ 新建</button><button class="btn ghost" id="buddyJoinBtn" type="button">＋ 加入</button>${activeSpace?(activeSpace.owner_id===sessionUser?.id?'<button class="btn danger" id="buddyDeleteSpace" type="button">删除这个饭搭子</button>':'<button class="btn danger" id="buddyLeaveSpace" type="button">退出</button>'):''}</div></section><div id="buddySetupInline" hidden>${setupHtml()}</div>`;
}

function editorHtml(){
  const mine=logs.find(l=>l.user_id===sessionUser?.id)||{};
  return `<section class="card buddy-checkin"><div class="buddy-checkin-head"><div><span class="eyebrow">MY CHECK-IN</span><h2>我今天吃了什么？</h2><p class="meal-meta">数量不用很精确，写“200g、2个、1碗、半份”都可以。</p></div><span class="buddy-date-pill">📅 今天</span></div><form id="buddyCheckinForm"><div class="buddy-meal-editor">${MEALS.map(([key,label,emoji])=>{const v=mealValue(mine,key);return `<div class="buddy-meal-row"><label>${emoji} ${label}</label><input name="${key}Food" value="${esc(v.food||'')}" placeholder="吃了什么"><input name="${key}Amount" value="${esc(v.amount||'')}" placeholder="吃多少"></div>`}).join('')}</div><div class="buddy-fitness-row"><label><input type="checkbox" name="fitnessDone" ${mine.fitness_done?'checked':''}> 🏋️ 今天健身了</label><select name="fitnessType"><option value="">运动类型</option>${['力量训练','有氧','跑步','游泳','球类','散步','其他'].map(x=>`<option ${mine.fitness_type===x?'selected':''}>${x}</option>`).join('')}</select><input name="fitnessMinutes" type="number" min="0" max="1440" value="${mine.fitness_minutes||''}" placeholder="分钟"><span class="meal-meta">没练就留空</span></div><textarea class="buddy-note" name="note" rows="2" maxlength="500" placeholder="今天想和饭搭子说点什么…">${esc(mine.note||'')}</textarea><div class="buddy-save-row"><button class="btn primary" type="submit">保存今日打卡</button></div></form></section>`;
}

function personHtml(member){
  const log=logs.find(l=>l.user_id===member.user_id);const me=member.user_id===sessionUser?.id;
  const status=log?'今日已打卡':'还没打卡';
  const reactionHtml=REACTIONS.map(emoji=>{const rows=reactions.filter(r=>r.target_user_id===member.user_id&&r.emoji===emoji);const mine=rows.some(r=>r.reactor_user_id===sessionUser?.id);return `<button class="buddy-react ${mine?'mine':''}" data-buddy-react="${member.user_id}" data-emoji="${emoji}" type="button">${emoji}${rows.length?` ${rows.length}`:''}</button>`}).join('');
  return `<article class="card buddy-person ${me?'me':''}"><div class="buddy-person-head"><div class="buddy-person-name"><span class="buddy-avatar">${me?'🙂':'🧑'}</span><div><h3>${esc(member.display_name)}${me?' · 我':''}</h3><small>${me?'我的今日记录':'TA 的今日记录'}</small></div></div><span class="buddy-status-pill">${status}</span></div><div class="buddy-meal-list">${MEALS.map(([key,label,emoji])=>{const v=mealValue(log,key);return `<div class="buddy-meal-item"><span>${emoji} ${label}</span><b>${esc(v.food||'还没记录')}</b><em>${esc(v.amount||'')}</em></div>`}).join('')}</div><div class="buddy-fitness-summary">${log?.fitness_done?`💪 ${esc(log.fitness_type||'今天运动了')}${log.fitness_minutes?` · ${log.fitness_minutes} 分钟`:''}`:'🛋️ 今天暂未记录健身'}</div>${log?.note?`<p class="buddy-note-view">“${esc(log.note)}”</p>`:''}<div class="buddy-reactions">${reactionHtml}</div></article>`;
}

function activeHtml(){
  return `${toolbarHtml()}${editorHtml()}<div class="buddy-section-head"><div><span class="eyebrow">TODAY TOGETHER</span><h2>今天大家吃了什么</h2></div><span class="meal-meta">${members.length} 位饭搭子</span></div><div class="buddy-people-grid">${members.map(personHtml).join('')}</div>`;
}

function bindSetup(root=document){
  $('#buddyCreateForm',root)?.addEventListener('submit',createSpace);
  $('#buddyJoinForm',root)?.addEventListener('submit',joinSpace);
}
function bindActive(){
  $('#buddySpaceSelect')?.addEventListener('change',async e=>{localStorage.setItem(ACTIVE_KEY,e.target.value);await refresh();});
  $('#buddyNewBtn')?.addEventListener('click',()=>{const el=$('#buddySetupInline');if(el){el.hidden=!el.hidden;if(!el.hidden)bindSetup(el);}});
  $('#buddyJoinBtn')?.addEventListener('click',()=>{const el=$('#buddySetupInline');if(el){el.hidden=!el.hidden;if(!el.hidden)bindSetup(el);}});
  $('#buddyCheckinForm')?.addEventListener('submit',saveCheckin);
  $('#buddyDeleteSpace')?.addEventListener('click',deleteSpace);
  $('#buddyLeaveSpace')?.addEventListener('click',leaveSpace);
  $$('[data-buddy-react]').forEach(b=>b.addEventListener('click',()=>toggleReaction(b.dataset.buddyReact,b.dataset.emoji)));
}

async function render(){
  ensurePage();ensureHomeStrip();setVersion();const root=$('#buddyContent');if(!root)return;
  if(!supabase){root.innerHTML='<div class="card buddy-empty"><h3>云端暂不可用</h3><p>饭搭子需要登录和云端同步。</p></div>';return;}
  if(!sessionUser){root.innerHTML='<div class="card buddy-empty"><h3>登录后开启饭搭子</h3><p>点右上角头像登录。这个模块和普通群组完全独立。</p></div>';return;}
  if(!spaces.length){root.innerHTML=setupHtml();bindSetup(root);return;}
  root.innerHTML=`<div class="buddy-shell">${activeHtml()}</div>`;bindActive();
}

async function refresh(){
  if(loading)return;loading=true;try{await loadSession();await loadSpaces();await loadActiveData();await render();}finally{loading=false;}
}

async function createSpace(e){
  e.preventDefault();if(!sessionUser)return;const name=e.currentTarget.elements.name.value.trim()||'饭搭子';const btn=e.submitter;btn.disabled=true;
  const {data,error}=await supabase.from('food_buddy_spaces').insert({name,owner_id:sessionUser.id}).select('id').single();btn.disabled=false;
  if(error){toast(error.message||'创建失败');return;}localStorage.setItem(ACTIVE_KEY,data.id);toast('饭搭子创建好了');await refresh();
}
async function joinSpace(e){
  e.preventDefault();const code=e.currentTarget.elements.code.value.trim().toUpperCase();const btn=e.submitter;btn.disabled=true;
  const {data,error}=await supabase.rpc('join_food_buddy',{p_invite_code:code});btn.disabled=false;
  if(error){toast(error.message?.includes('满员')?'这个饭搭子已经满员（最多5人）':(error.message||'加入失败'));return;}localStorage.setItem(ACTIVE_KEY,data);toast('加入成功');await refresh();
}
async function saveCheckin(e){
  e.preventDefault();if(!activeSpace||!sessionUser)return;const f=e.currentTarget;const meals={};MEALS.forEach(([key])=>{meals[key]={food:f.elements[`${key}Food`].value.trim(),amount:f.elements[`${key}Amount`].value.trim()};});
  const payload={space_id:activeSpace.id,user_id:sessionUser.id,log_date:todayISO(),meals,fitness_done:f.elements.fitnessDone.checked,fitness_type:f.elements.fitnessDone.checked?f.elements.fitnessType.value:'',fitness_minutes:f.elements.fitnessDone.checked?Number(f.elements.fitnessMinutes.value||0):0,note:f.elements.note.value.trim(),updated_at:new Date().toISOString()};
  const btn=e.submitter;btn.disabled=true;const {error}=await supabase.from('food_buddy_daily_logs').upsert(payload,{onConflict:'space_id,user_id,log_date'});btn.disabled=false;if(error){toast(error.message||'保存失败');return;}toast('今天的打卡保存好了');await refresh();
}
async function toggleReaction(target,emoji){
  if(!activeSpace||!sessionUser)return;const mine=reactions.find(r=>r.target_user_id===target&&r.reactor_user_id===sessionUser.id&&r.emoji===emoji);
  if(mine){await supabase.from('food_buddy_reactions').delete().eq('id',mine.id);}else{await supabase.from('food_buddy_reactions').insert({space_id:activeSpace.id,log_date:todayISO(),target_user_id:target,reactor_user_id:sessionUser.id,emoji});}await loadActiveData();await render();
}
async function deleteSpace(){if(!activeSpace||activeSpace.owner_id!==sessionUser?.id)return;if(!confirm('删除这个饭搭子吗？成员和打卡记录都会一起删除。'))return;const {error}=await supabase.from('food_buddy_spaces').delete().eq('id',activeSpace.id);if(error){toast(error.message);return;}localStorage.removeItem(ACTIVE_KEY);toast('饭搭子已删除');await refresh();}
async function leaveSpace(){if(!activeSpace||!sessionUser)return;if(!confirm('退出这个饭搭子吗？'))return;const {error}=await supabase.from('food_buddy_members').delete().eq('space_id',activeSpace.id).eq('user_id',sessionUser.id);if(error){toast(error.message);return;}localStorage.removeItem(ACTIVE_KEY);toast('已退出');await refresh();}

function init(){injectStyles();ensurePage();setVersion();const observer=new MutationObserver(()=>ensureHomeStrip());observer.observe(document.body,{childList:true,subtree:true});setTimeout(()=>{ensureHomeStrip();refresh();},900);window.addEventListener('hashchange',()=>{setVersion();if(location.hash==='#buddies')refresh();});window.addEventListener('focus',setVersion);window.addEventListener('fansfood-account-changed',refresh);if(supabase)supabase.auth.onAuthStateChange(()=>setTimeout(refresh,200));}
init();
