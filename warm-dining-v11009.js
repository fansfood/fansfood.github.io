import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const VERSION = '1.1.009';
const cfg = window.SHIGUANG_CONFIG || {};
const supabase = cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY
  ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage}
    })
  : null;

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const esc = (v='') => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let enhancing = false;
let enhanceTimer = null;
let homeTimer = null;
let lastProfile = null;
let versionObserver = null;

const ICONS = {
  home:'<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  utensils:'<path d="M3 2v7a3 3 0 0 0 3 3V2"/><path d="M6 2v20"/><path d="M18 2v8a4 4 0 0 1-4 4V6a4 4 0 0 1 4-4Z"/><path d="M18 10v12"/>',
  calendar:'<path d="M8 2v4M16 2v4"/><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
  book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
  cart:'<circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M3 4h2l2.4 10.4A2 2 0 0 0 9.35 16H18a2 2 0 0 0 1.94-1.52L21 8H6"/>',
  fridge:'<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M6 10h12M10 6v2M10 14v2"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
  chart:'<path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  spark:'<path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z"/><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 3.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2v-4h.1A1.7 1.7 0 0 0 3.6 8a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8 3.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2h4v.1A1.7 1.7 0 0 0 15 3.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 8c.23.37.43.65.6 1 .17.35.3.72.4 1.1h.1v4h-.1c-.1.38-.23.75-.4 1.1-.17.35-.37.63-.6 1Z"/>',
  logout:'<path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/>',
  vote:'<path d="M4 21V10M10 21V3M16 21v-7M22 21V7"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
};
function icon(name, cls=''){
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||ICONS.spark}</svg>`;
}
function toast(message){const el=$('#toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(el._wdT);el._wdT=setTimeout(()=>el.classList.remove('show'),2100);}
function readState(){try{return JSON.parse(localStorage.getItem('shiguang-v2-state')||'{}')||{}}catch{return{}}}
function localDateISO(offset=0){const d=new Date();d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function tomorrowISO(){return localDateISO(1)}
function initials(name='食光'){const t=String(name).replace(/^@/,'').trim();return (t.slice(0,2)||'食光').toUpperCase();}

function setVersion(){
  const badge=$('.brand small');if(badge&&badge.textContent!==`v${VERSION}`)badge.textContent=`v${VERSION}`;
  const side=$('#wdSideVersion');if(side)side.textContent=`v${VERSION}`;
}
function installVersionGuard(){
  setVersion();const badge=$('.brand small');
  if(badge&&!versionObserver){versionObserver=new MutationObserver(setVersion);versionObserver.observe(badge,{childList:true,characterData:true,subtree:true});}
}

function applyBrand(){
  document.body.classList.add('warm-dining');
  document.title='食光 · Eating Time';
  const theme=$('meta[name="theme-color"]');if(theme)theme.setAttribute('content','#FF8A24');
  const desc=$('meta[name="description"]');if(desc)desc.setAttribute('content','食光 Eating Time：家庭、情侣、朋友一起决定吃什么、记录吃过什么的轻量美食生活 App。');
  const favicon=$('link[rel="icon"]');if(favicon)favicon.href='assets/images/app-icon.svg';
  const brand=$('.topbar>.brand');
  if(brand){
    const mark=$('.brand-mark',brand);if(mark)mark.innerHTML='<img src="assets/images/eating-time-mark.svg" alt="" width="40" height="40">';
    const name=[...brand.children].find(x=>x.tagName==='SPAN'&&!x.classList.contains('brand-mark'));if(name)name.textContent='食光';
  }
}

const navInfo={
  '#home':['首页','home'],'#groups':['我的群组','users'],'#buddies':['饭搭子','utensils'],'#tomorrow':['明天吃什么','clock'],
  '#menu':['近七天菜谱','calendar'],'#recipes':['食谱','book'],'#shopping':['采购','cart'],'#pantry':['我的冰箱','fridge']
};
function decorateNav(){
  const nav=$('#nav');if(!nav)return;
  if(!nav.querySelector('a[href="#buddies"]')){
    const a=document.createElement('a');a.href='#buddies';a.textContent='饭搭子';
    const groups=nav.querySelector('a[href="#groups"]');groups?.insertAdjacentElement('afterend',a);
  }
  $$('a',nav).forEach(a=>{
    const href=a.getAttribute('href');const info=navInfo[href];if(!info)return;
    a.innerHTML=`${icon(info[1])}<span>${info[0]}</span>`;
  });
}

function buildShell(){
  if($('#wdSidebar')){decorateNav();return;}
  const topbar=$('.topbar'),nav=$('#nav');if(!topbar||!nav)return;
  const aside=document.createElement('aside');aside.className='wd-sidebar';aside.id='wdSidebar';
  aside.innerHTML=`<a class="wd-sidebar-brand" href="#home"><img src="assets/images/eating-time-mark.svg" alt=""><span><strong>食光</strong><small>Eating Time · <span id="wdSideVersion">v${VERSION}</span></small></span></a><div id="wdNavSlot"></div><div class="wd-sidebar-spacer"></div><div class="wd-sidebar-footer"><div class="wd-side-user"><span class="wd-side-avatar" id="wdSideAvatar">食光</span><div><b id="wdSideName">未登录</b><small id="wdSideRole">点击头像登录</small></div><button id="wdSideSettings" type="button" aria-label="账户设置">${icon('settings')}</button></div></div>`;
  document.body.insertBefore(aside,topbar);
  $('#wdNavSlot',aside).appendChild(nav);decorateNav();

  const actions=$('.top-actions',topbar);
  if(actions&&!$('#wdHeaderSearch')){
    const search=document.createElement('label');search.className='wd-header-search';search.id='wdHeaderSearch';search.innerHTML=`${icon('search')}<input id="wdGlobalSearch" type="search" placeholder="搜索菜谱、食材、想法…" aria-label="全站搜索">`;
    actions.insertBefore(search,actions.firstChild);
    const bell=document.createElement('button');bell.className='wd-icon-btn';bell.id='wdBell';bell.type='button';bell.setAttribute('aria-label','通知');bell.innerHTML=icon('bell');
    actions.insertBefore(bell,$('#accountBtn',actions));
    $('#wdBell').onclick=()=>toast('目前没有新的通知');
    $('#wdGlobalSearch').addEventListener('keydown',e=>{if(e.key!=='Enter')return;const q=e.currentTarget.value.trim();location.hash='#recipes';setTimeout(()=>{const input=$('#recipeSearch');if(input){input.value=q;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();}},120);});
  }
  const account=$('#accountBtn');if(account){account.innerHTML=icon('user');account.title='我的账户';}
  const settings=$('#wdSideSettings');if(settings)settings.onclick=()=>$('#accountBtn')?.click();
  buildMobileNav();buildActionSheet();updateRouteUI();
}

function buildMobileNav(){
  if($('#wdMobileBottom'))return;
  const bar=document.createElement('nav');bar.className='wd-mobile-bottom';bar.id='wdMobileBottom';bar.setAttribute('aria-label','手机底部导航');
  bar.innerHTML=`
    <a class="wd-bottom-link" href="#home" data-wd-bottom="#home">${icon('home')}<span>首页</span></a>
    <a class="wd-bottom-link" href="#groups" data-wd-bottom="#groups">${icon('users')}<span>群组</span></a>
    <button class="wd-bottom-plus" id="wdQuickPlus" type="button" aria-label="快速添加">${icon('plus')}</button>
    <a class="wd-bottom-link" href="#recipes" data-wd-bottom="#recipes">${icon('book')}<span>菜谱</span></a>
    <button class="wd-bottom-link" id="wdBottomAccount" type="button">${icon('user')}<span>我的</span></button>`;
  document.body.appendChild(bar);
  $('#wdQuickPlus').onclick=()=>openSheet();$('#wdBottomAccount').onclick=()=>$('#accountBtn')?.click();
}
function buildActionSheet(){
  if($('#wdActionSheet'))return;
  const sheet=document.createElement('div');sheet.className='wd-sheet';sheet.id='wdActionSheet';sheet.innerHTML=`<div class="wd-sheet-panel" role="dialog" aria-modal="true" aria-label="快速添加"><div class="wd-sheet-handle"></div><h3>想做点什么？</h3><div class="wd-sheet-grid">
    <button class="wd-sheet-action" data-wd-action="recipe">${icon('book')}发布菜谱</button>
    <button class="wd-sheet-action" data-wd-action="vote">${icon('vote')}发起 / 查看投票</button>
    <button class="wd-sheet-action" data-wd-action="shopping">${icon('cart')}添加采购</button>
    <button class="wd-sheet-action" data-wd-action="pantry">${icon('fridge')}添加冰箱食材</button>
    <button class="wd-sheet-action" data-wd-action="group">${icon('users')}创建 / 加入群组</button>
  </div></div>`;
  document.body.appendChild(sheet);
  sheet.addEventListener('click',e=>{if(e.target===sheet)closeSheet();});
  $$('[data-wd-action]',sheet).forEach(btn=>btn.onclick=()=>runQuickAction(btn.dataset.wdAction));
}
function openSheet(){$('#wdActionSheet')?.classList.add('open')}
function closeSheet(){$('#wdActionSheet')?.classList.remove('open')}
function runQuickAction(action){
  closeSheet();
  if(action==='recipe'){location.hash='#recipes';setTimeout(()=>$('#newRecipeBtn')?.click(),120);return;}
  if(action==='vote'){location.hash='#tomorrow';return;}
  if(action==='shopping'){location.hash='#shopping';setTimeout(()=>$('#quickAddName')?.focus(),150);return;}
  if(action==='pantry'){location.hash='#pantry';setTimeout(()=>$('#pantryName')?.focus(),150);return;}
  if(action==='group'){location.hash='#groups';setTimeout(()=>$('#createGroupName,#joinGroupCode')?.focus(),180);}
}
function updateRouteUI(){
  const hash=location.hash||'#home';
  $$('#nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')===hash));
  $$('[data-wd-bottom]').forEach(a=>a.classList.toggle('active',a.dataset.wdBottom===hash));
}

async function getSessionProfile(){
  if(!supabase)return {user:null,profile:null};
  const {data}=await supabase.auth.getSession();const user=data.session?.user||null;if(!user)return {user:null,profile:null};
  const {data:profile}=await supabase.from('user_accounts').select('username,food_role').eq('user_id',user.id).maybeSingle();
  lastProfile=profile||null;return {user,profile:profile||null};
}
function roleName(role){return role==='chef'?'大厨':role==='foodie'?'美食鉴赏家':'食光朋友'}
async function updateAccountChrome(){
  const {user,profile}=await getSessionProfile();
  const name=profile?.username?`@${profile.username}`:'未登录';const role=user?roleName(profile?.food_role):'点击头像登录';
  const sideName=$('#wdSideName'),sideRole=$('#wdSideRole'),sideAvatar=$('#wdSideAvatar');
  if(sideName)sideName.textContent=name;if(sideRole)sideRole.textContent=role;if(sideAvatar)sideAvatar.textContent=user?initials(profile?.username||user.email||'食光'):'食光';
  const account=$('#accountBtn');if(account)account.innerHTML=user?`<span class="wd-avatar" style="width:100%;height:100%">${esc(initials(profile?.username||user.email||'食光'))}</span>`:icon('user');
}

function recipeMap(){
  const map=new Map();
  $$('#recipeGrid .recipe-card').forEach(card=>{
    const id=$('[data-open]',card)?.dataset.open||$('[data-fav]',card)?.dataset.fav;if(!id)return;
    const tags=$$('.tag',card).map(x=>x.textContent.trim());
    map.set(id,{id,name:$('h3',card)?.textContent.trim()||'未命名菜谱',image:$('img',card)?.src||'',category:tags[0]||'',difficulty:tags[1]||'',meta:$('.recipe-footer>span',card)?.textContent.trim()||'',user:Boolean($('.user-badge',card))});
  });
  return map;
}
function rollingDays(){
  const weekdays=['周日','周一','周二','周三','周四','周五','周六'];const out=[];const base=new Date();base.setHours(12,0,0,0);
  for(let i=0;i<7;i++){const d=new Date(base);d.setDate(base.getDate()+i);out.push({date:d,key:weekdays[d.getDay()],relative:i===0?'今天':i===1?'明天':i===2?'后天':weekdays[d.getDay()],label:`${d.getMonth()+1}/${d.getDate()}`});}return out;
}
function dayCardsHtml(state,recipes){
  const slots=['早餐','午餐','晚餐'];
  return rollingDays().map((d,i)=>{
    const meals=slots.map(slot=>({slot,recipe:recipes.get(state?.plan?.[d.key]?.[slot])}));const available=meals.filter(x=>x.recipe);const cover=available[0]?.recipe?.image||'';
    return `<article class="wd-day-card ${i===0?'today':''}"><div class="wd-day-head"><b>${d.relative}</b><span>${d.label}</span></div>${cover?`<div class="wd-day-cover"><img src="${esc(cover)}" alt="${esc(available[0].recipe.name)}"></div>`:`<div class="wd-day-empty">今天还没有安排<a href="#menu">＋ 添加菜谱</a></div>`}<div class="wd-day-meals">${meals.map(x=>`<div class="wd-day-meal"><span>${x.slot}</span><b>${esc(x.recipe?.name||'未安排')}</b></div>`).join('')}</div></article>`;
  }).join('');
}
function tipFromState(state){
  const pantry=Array.isArray(state?.pantry)?state.pantry:[];const today=new Date();today.setHours(0,0,0,0);
  const soon=pantry.map(x=>({x,d:x.expiry?new Date(`${x.expiry}T00:00:00`):null})).filter(o=>o.d&&!Number.isNaN(o.d)).map(o=>({...o,days:Math.ceil((o.d-today)/86400000)})).filter(o=>o.days>=0&&o.days<=2).sort((a,b)=>a.days-b.days)[0];
  if(soon)return {title:'先吃掉快到期的食材',text:`冰箱里的「${soon.x.name}」${soon.days===0?'今天到期':soon.days===1?'明天到期':`还有 ${soon.days} 天到期`}，今天安排它会更安心。`};
  const manual=Array.isArray(state?.manualShopping)?state.manualShopping.length:0;if(manual)return {title:'采购前先看一眼清单',text:`目前还有 ${manual} 项手动采购记录。去超市前确认一下冰箱库存，可以少买重复的东西。`};
  return {title:'好好吃饭，好好生活',text:'不用把每一餐都安排得很复杂。能和喜欢的人坐下来吃顿饭，本身就是一天里很好的时间。'};
}
function recentRecipesHtml(recipes,state){
  const fav=new Set(state?.favorites||[]);const list=[...recipes.values()].sort((a,b)=>(fav.has(b.id)?1:0)-(fav.has(a.id)?1:0)).slice(0,3);
  if(!list.length)return '<div class="empty">还没有菜谱数据。</div>';
  return list.map(r=>`<button class="wd-recent-card" type="button" data-wd-recipe="${esc(r.id)}"><img src="${esc(r.image)}" alt="${esc(r.name)}"><div><b>${esc(r.name)}</b><span>${esc(r.category||'食光菜谱')}${fav.has(r.id)?' · 已收藏':''}</span></div></button>`).join('');
}

function baseHomeHtml(profile,state,recipes){
  const tip=tipFromState(state);const title=profile?`嗨，欢迎回来，${roleName(profile.food_role)}`:'嗨，欢迎来到食光';const subtitle=profile?.username?`@${esc(profile.username)} · 今天想先从哪一项开始？`:'登录后，和家人朋友一起安排今天与明天。';
  return `<div class="wd-home-top"><div class="wd-home-greeting"><h1>${title}</h1><p>${subtitle}</p></div><span class="wd-home-status">云端同步中</span></div>
    <div class="wd-core-grid">
      <a class="card wd-core-card groups" href="#groups" id="wdHomeGroups"><span class="wd-card-kicker">MY GROUPS</span><h2>我的群组</h2><p>进入自己的小饭桌，看看成员、群内菜谱和投票情况。</p><span class="wd-card-plate"></span><div class="wd-card-bottom"><div class="wd-card-meta"><div class="wd-avatar-stack" id="wdGroupAvatars"></div><span id="wdGroupMeta">读取群组中…</span></div><span class="wd-card-cta">进入 ${icon('arrow')}</span></div></a>
      <a class="card wd-core-card tomorrow" href="#tomorrow" id="wdHomeTomorrow"><span class="wd-card-kicker">TOMORROW</span><h2>明天吃什么</h2><p>还没决定明天吃什么？看看大家的想法吧。</p><div class="wd-card-bottom"><div class="wd-card-meta" id="wdTomorrowMeta">读取投票中…</div><span class="wd-card-cta">去投票 ${icon('arrow')}</span></div></a>
      <a class="card wd-core-card recipes" href="#recipes" id="wdHomeRecipe"><span class="wd-card-kicker">RECIPES</span><h2>菜谱</h2><p>收藏和分享你的拿手菜，记录你的美食灵感。</p><div class="wd-card-bottom"><div class="wd-card-meta" id="wdRecipeMeta">${recipes.size} 道可浏览菜谱</div><span class="wd-card-cta">看看菜谱 ${icon('arrow')}</span></div></a>
    </div>
    <section class="wd-section"><div class="wd-section-title"><div><h2>快速入口</h2><p>常用功能，一步就到。</p></div></div><div class="wd-quick-grid">
      <a class="wd-quick-action" href="#buddies"><span class="wd-icon-tile">${icon('users')}</span><b>饭搭子</b></a>
      <a class="wd-quick-action" href="#shopping"><span class="wd-icon-tile">${icon('cart')}</span><b>采购</b></a>
      <a class="wd-quick-action" href="#recipes" data-wd-favorites><span class="wd-icon-tile">${icon('heart')}</span><b>菜谱收藏</b></a>
      <a class="wd-quick-action" href="#tomorrow"><span class="wd-icon-tile">${icon('chart')}</span><b>明日投票</b></a>
      <a class="wd-quick-action" href="#pantry"><span class="wd-icon-tile">${icon('fridge')}</span><b>我的冰箱</b></a>
    </div></section>
    <section class="wd-section"><div class="wd-section-title"><div><h2>近七天菜谱</h2><p>从今天开始，看看接下来七天怎么吃。</p></div><a href="#menu">查看完整安排 →</a></div><div class="wd-seven-scroll">${dayCardsHtml(state,recipes)}</div></section>
    <div class="wd-home-lower"><section class="card wd-tip-card"><span class="wd-tip-mark">${icon('spark')}</span><h3>${esc(tip.title)}</h3><p>${esc(tip.text)}</p></section><section><div class="wd-section-title"><div><h2>最近菜谱</h2><p>继续看看最近收藏和常用的菜。</p></div><a href="#recipes">查看更多 →</a></div><div class="wd-recent-grid">${recentRecipesHtml(recipes,state)}</div></section></div>
    <div class="wd-home-compat" aria-hidden="true"><div id="todayMeals"></div><span id="pantryCount">0</span><span id="favoriteCount">0</span><span id="shoppingCount">0</span><span id="syncText"></span><span id="syncDot"></span></div>`;
}
async function renderHome(){
  clearTimeout(homeTimer);homeTimer=setTimeout(async()=>{
    const home=$('#home');if(!home)return;const active=home.classList.contains('active');const state=readState();const recipes=recipeMap();const {user,profile}=await getSessionProfile();
    home.className=`page wd-home${active?' active':''}`;home.innerHTML=baseHomeHtml(profile,state,recipes);
    $$('[data-wd-recipe]',home).forEach(btn=>btn.onclick=()=>{const original=$(`#recipeGrid [data-open="${CSS.escape(btn.dataset.wdRecipe)}"]`);original?.click();});
    $('[data-wd-favorites]',home)?.addEventListener('click',()=>setTimeout(()=>{const all=$$('#recipeFilters [data-cat]').find(b=>b.dataset.cat==='全部');all?.click();},100));
    await fillHomeCloud(user,profile,recipes,state);setVersion();
  },90);
}
async function fillHomeCloud(user,profile,recipes,state){
  const status=$('.wd-home-status');if(status)status.textContent=user?'云端已连接':'登录后自动同步';
  const fav=new Set(state?.favorites||[]);const recipe=[...recipes.values()].find(r=>fav.has(r.id))||[...recipes.values()][0];
  if(recipe){const card=$('#wdHomeRecipe');card?.querySelector('.wd-card-food')?.remove();const img=document.createElement('img');img.className='wd-card-food';img.src=recipe.image;img.alt='';card?.appendChild(img);const meta=$('#wdRecipeMeta');if(meta)meta.textContent=`${fav.size} 道收藏 · ${recipes.size} 道菜谱`;}
  if(!user||!supabase){const gm=$('#wdGroupMeta');if(gm)gm.textContent='登录后查看你的饭桌';const tm=$('#wdTomorrowMeta');if(tm)tm.textContent='登录后参与群组投票';return;}
  const {data:groups}=await supabase.from('food_groups').select('id,name,owner_id').order('created_at',{ascending:false});const gs=groups||[];const wanted=localStorage.getItem('fansfood-active-group');const active=gs.find(g=>g.id===wanted)||gs[0]||null;
  const gm=$('#wdGroupMeta');if(gm)gm.textContent=gs.length?`${gs.length} 个群组${active?` · ${active.name}`:''}`:'还没有加入群组';
  if(active){
    const {data:members}=await supabase.from('group_members').select('member_name').eq('group_id',active.id).limit(5);const avatars=$('#wdGroupAvatars');if(avatars)avatars.innerHTML=(members||[]).map(m=>`<span>${esc(initials(m.member_name))}</span>`).join('');
    const {data:dishes}=await supabase.from('site_dishes').select('id,name,image_path,image_url,is_active').eq('group_id',active.id).eq('is_active',true).limit(8);const ds=dishes||[];
    const {data:votes}=await supabase.from('tomorrow_votes').select('id,dish_id,voter_user_id').eq('group_id',active.id).eq('target_date',tomorrowISO());
    const tm=$('#wdTomorrowMeta');if(tm)tm.textContent=ds.length?`${ds.length} 道候选${votes?.length?` · ${votes.length} 份选择`:''}`:'大厨还没添加候选菜';
    const d=ds[0];if(d){let src=d.image_url||'';if(!src&&d.image_path)src=supabase.storage.from('dish-images').getPublicUrl(d.image_path).data.publicUrl;if(src){const card=$('#wdHomeTomorrow');const img=document.createElement('img');img.className='wd-card-food';img.src=src;img.alt='';card?.appendChild(img);}}
  }
}

function enhanceMenu(){
  const page=$('#menu');if(!page)return;const nav=$('#nav a[href="#menu"] span');if(nav)nav.textContent='近七天菜谱';
  const title=$('.page-title h1',page);if(title)title.textContent='近七天菜谱';const eyebrow=$('.page-title .eyebrow',page);if(eyebrow)eyebrow.textContent='NEXT 7 DAYS';const p=$('.page-title p',page);if(p)p.textContent='从今天开始安排未来七天的早餐、午餐和晚餐；采购清单会继续按你的安排自动汇总。';
  const days=rollingDays();const map=new Map(days.map(d=>[d.key,d]));$$('#weekTabs button',page).forEach(btn=>{const d=map.get(btn.dataset.day);if(!d)return;btn.innerHTML=`<span>${d.relative}</span><small>${d.label}</small>`;});
  if(!page.dataset.wdTodaySelected){const today=days[0];const btn=$(`#weekTabs button[data-day="${today.key}"]`,page);if(btn&&!btn.classList.contains('active'))btn.click();page.dataset.wdTodaySelected='1';}
}

function enhanceGroups(){
  const panel=$('#activeGroupPanel');if(!panel)return;const grid=$('.group-content-grid',panel);if(!grid)return;
  $$('.group-module',grid).forEach(module=>{const text=$('h3',module)?.textContent||'';if(text.includes('成员'))module.dataset.wdSection='members';else if(text.includes('菜谱'))module.dataset.wdSection='recipes';else if(text.includes('采购'))module.dataset.wdSection='shopping';});
  if(!$('.wd-group-tabs',panel)){
    const tabs=document.createElement('div');tabs.className='wd-group-tabs';tabs.innerHTML=[['today','今日'],['recipes','菜谱'],['vote','投票'],['members','成员'],['shopping','采购']].map(([k,t])=>`<button type="button" data-wd-tab="${k}">${t}</button>`).join('');
    grid.insertAdjacentElement('beforebegin',tabs);panel.dataset.wdTab='today';
    const vote=document.createElement('a');vote.href='#tomorrow';vote.className='card wd-group-vote-link';vote.innerHTML=`<span class="eyebrow">TOMORROW VOTE</span><h3>去看看大家明天想吃什么</h3><p>候选菜和投票结果继续使用当前群组的真实数据。</p><span class="btn primary">进入投票页</span>`;grid.insertAdjacentElement('beforebegin',vote);
    $$('[data-wd-tab]',tabs).forEach(b=>b.onclick=()=>{panel.dataset.wdTab=b.dataset.wdTab;$$('[data-wd-tab]',tabs).forEach(x=>x.classList.toggle('active',x===b));});$('[data-wd-tab="today"]',tabs)?.classList.add('active');
  }
  $$('.member-row>span',panel).forEach(s=>{if(!s.querySelector('svg'))s.innerHTML=icon('user');});
}

function enhanceTomorrow(){
  const page=$('#tomorrow');if(!page)return;const h=$('.tomorrow-hero h1',page);if(h)h.textContent='明天吃什么？';const p=$('.tomorrow-hero p',page);if(p)p.textContent='大家一起决定明天的菜单。每个群组的候选菜和投票彼此独立。';
  $$('.vote-card .vote-btn',page).forEach(btn=>{if(btn.textContent.trim()==='我想吃这个')btn.textContent='投这一票';});
  const hero=$('.tomorrow-hero',page);if(hero&&!$('.wd-tomorrow-media',hero)){
    const src=$('.vote-card-photo img',page)?.src;if(src){const media=document.createElement('div');media.className='wd-tomorrow-media';media.innerHTML=`<img src="${esc(src)}" alt="候选菜">`;hero.appendChild(media);}
  }
}

function enhanceRecipes(){
  const search=$('#recipeSearch');if(search)search.placeholder='搜索菜谱、食材、想法…';
  $$('#recipeGrid .recipe-card').forEach(card=>{if($('.wd-recipe-author',card))return;const body=$('.recipe-body',card);if(!body)return;const mine=Boolean($('.user-badge',card));const row=document.createElement('div');row.className='wd-recipe-author';row.innerHTML=`<span>${mine?'我':'食'}</span>${mine?'我的菜谱':'食光精选'}`;$('.recipe-tags',body)?.insertAdjacentElement('afterend',row);});
  enhanceRecipeDialogActions();
}
function enhanceRecipeDialogActions(){
  const body=$('#recipeDialogContent .dialog-body');if(!body||$('.wd-recipe-actions',body))return;
  const actions=document.createElement('div');actions.className='wd-recipe-actions';actions.innerHTML=`<button class="btn ghost" id="wdAddRecipeShopping" type="button">${icon('cart')} 加入采购清单</button><button class="btn primary" id="wdEatTomorrow" type="button">明天就吃它</button>`;body.appendChild(actions);
  $('#wdAddRecipeShopping').onclick=addCurrentRecipeToShopping;$('#wdEatTomorrow').onclick=addCurrentRecipeToTomorrow;
}
async function addCurrentRecipeToShopping(){
  const ingredients=$$('#recipeDialogContent .ingredient').map((el,i)=>({name:$('b',el)?.textContent.trim()||'',qtyText:$('.meal-meta',el)?.textContent.trim()||'',category:'其他',id:`manual:recipe:${Date.now()}:${i}`})).filter(x=>x.name);if(!ingredients.length){toast('这道菜暂时没有可加入的食材');return;}
  const state=readState();state.manualShopping=[...(state.manualShopping||[]),...ingredients];localStorage.setItem('shiguang-v2-state',JSON.stringify(state));
  if(supabase){const {data}=await supabase.auth.getSession();const user=data.session?.user;if(user)await supabase.from('app_state').upsert({user_id:user.id,manual_shopping:state.manualShopping,updated_at:new Date().toISOString()},{onConflict:'user_id'});}
  toast(`已把 ${ingredients.length} 项食材加入采购清单`);setTimeout(()=>{location.hash='#shopping';location.reload();},450);
}
async function addCurrentRecipeToTomorrow(){
  if(!supabase){location.hash='#tomorrow';return;}const {data}=await supabase.auth.getSession();const user=data.session?.user;if(!user){toast('登录后才能加入群组候选菜');$('#accountBtn')?.click();return;}
  const groupId=localStorage.getItem('fansfood-active-group');if(!groupId){toast('先选择一个群组');location.hash='#groups';return;}
  const {data:member}=await supabase.from('group_members').select('member_role').eq('group_id',groupId).eq('user_id',user.id).maybeSingle();if(member?.member_role!=='chef'){toast('只有本群大厨可以把新菜加入明日候选');location.hash='#tomorrow';return;}
  const name=$('#recipeDialogContent .dialog-title-overlay h2')?.textContent.trim()||'食光菜谱';const category=$('#recipeDialogContent .dialog-title-overlay .eyebrow')?.textContent.trim()||'其他';const description=$('#recipeDialogContent .recipe-intro')?.textContent.trim()||'从食光菜谱加入的明日候选。';const src=$('#recipeDialogContent .dialog-hero img')?.src||'';
  let imagePath=null,imageUrl=null;
  try{
    if(src&&src.startsWith(location.origin))imageUrl=src;
    else if(src){const res=await fetch(src);if(res.ok){const blob=await res.blob();const ext=(blob.type.split('/')[1]||'jpg').replace('jpeg','jpg');imagePath=`${user.id}/${groupId}-${crypto.randomUUID()}.${ext}`;const up=await supabase.storage.from('dish-images').upload(imagePath,blob,{contentType:blob.type||'image/jpeg',upsert:false});if(up.error)imagePath=null;}}
    const {error}=await supabase.from('site_dishes').insert({name,description,category,image_path:imagePath,image_url:imageUrl,is_active:true,created_by:user.id,group_id:groupId});if(error)throw error;toast('已经加入当前群组的明日候选菜');$('#recipeDialog')?.close();location.hash='#tomorrow';
  }catch(e){toast(e?.message||'加入候选失败');}
}

function enhanceShopping(){
  const root=$('#shoppingGroups');if(!root)return;
  $$('.shopping-category-chip',root).forEach(chip=>{chip.textContent=chip.textContent.replace(/^\s*[^\p{L}\p{N}]+\s*/u,'');});
  if(!$('#wdShoppingFilters')){
    const categories=[...new Set($$('.shopping-item',root).map(r=>r.dataset.category).filter(Boolean))];if(categories.length){const filters=document.createElement('div');filters.className='wd-shopping-filters';filters.id='wdShoppingFilters';filters.innerHTML=['全部',...categories].map((x,i)=>`<button class="${i===0?'active':''}" data-wd-shop-cat="${esc(x)}">${esc(x)}</button>`).join('');root.insertAdjacentElement('beforebegin',filters);$$('[data-wd-shop-cat]',filters).forEach(btn=>btn.onclick=()=>{$$('[data-wd-shop-cat]',filters).forEach(x=>x.classList.toggle('active',x===btn));$$('.shopping-item',root).forEach(row=>row.hidden=btn.dataset.wdShopCat!=='全部'&&row.dataset.category!==btn.dataset.wdShopCat);});}}
}

function enhancePantry(){
  const root=$('#pantryGrid');if(!root)return;const state=readState();const pantry=Array.isArray(state.pantry)?state.pantry:[];const cards=$$('.pantry-card',root);
  cards.forEach((card,i)=>{const item=pantry[i];if(!item)return;card.dataset.wdCategory=item.category||'其他';if($('.wd-pantry-status',card))return;const status=document.createElement('span');status.className='wd-pantry-status';let text='新鲜';if(item.expiry){const diff=Math.ceil((new Date(`${item.expiry}T00:00:00`)-new Date(new Date().toDateString()))/86400000);if(diff<=1){status.classList.add('urgent');card.classList.add('wd-expiry-urgent');text=diff<0?'已过期':'即将过期';}else if(diff<=3){status.classList.add('soon');card.classList.add('wd-expiry-soon');text='快吃掉';}}status.textContent=text;card.appendChild(status);});
  if(!$('#wdPantryFilters')&&pantry.length){const cats=[...new Set(pantry.map(x=>x.category||'其他'))];const filters=document.createElement('div');filters.className='wd-pantry-filters';filters.id='wdPantryFilters';filters.innerHTML=['全部',...cats].map((x,i)=>`<button class="${i===0?'active':''}" data-wd-pantry-cat="${esc(x)}">${esc(x)}</button>`).join('');root.insertAdjacentElement('beforebegin',filters);$$('[data-wd-pantry-cat]',filters).forEach(btn=>btn.onclick=()=>{$$('[data-wd-pantry-cat]',filters).forEach(x=>x.classList.toggle('active',x===btn));$$('.pantry-card',root).forEach(card=>card.hidden=btn.dataset.wdPantryCat!=='全部'&&card.dataset.wdCategory!==btn.dataset.wdPantryCat);});}
  if(!$('#wdPantryRecipeCta')){const cta=document.createElement('button');cta.type='button';cta.className='wd-pantry-recipe-cta';cta.id='wdPantryRecipeCta';cta.innerHTML=`<span><b>这些食材可以做什么？</b><span>用冰箱里的食材去菜谱库找灵感</span></span>${icon('arrow')}`;root.insertAdjacentElement('beforebegin',cta);cta.onclick=()=>{const first=pantry[0]?.name||'';location.hash='#recipes';setTimeout(()=>{const input=$('#recipeSearch');if(input){input.value=first;input.dispatchEvent(new Event('input',{bubbles:true}));}},140);};}
}

async function enhanceBuddies(){
  const page=$('#buddies');if(!page)return;$$('.buddy-avatar',page).forEach(a=>{const card=a.closest('.buddy-person');const name=$('h3',card)?.textContent.replace(' · 我','').trim()||'饭友';a.textContent=initials(name);});
  const content=$('#buddyContent');if(!content||$('#wdBuddySummary'))return;const select=$('#buddySpaceSelect');const spaceId=select?.value||localStorage.getItem('shiguang-food-buddy-active');if(!spaceId||!supabase)return;
  const {data:logs,error}=await supabase.from('food_buddy_daily_logs').select('user_id,log_date,meals,fitness_done').eq('space_id',spaceId).order('log_date',{ascending:false}).limit(400);if(error)return;const rows=logs||[];const days=new Set(rows.map(x=>x.log_date));let mealCount=0,fitness=0;rows.forEach(row=>{fitness+=row.fitness_done?1:0;Object.values(row.meals||{}).forEach(v=>{const x=Array.isArray(v)?v[0]:v;if(x?.food)mealCount++;});});
  const summary=document.createElement('div');summary.className='wd-buddy-summary';summary.id='wdBuddySummary';summary.innerHTML=`<div class="card"><b>${days.size}</b><span>一起记录的天数</span></div><div class="card"><b>${mealCount}</b><span>记录过的餐次</span></div><div class="card"><b>${fitness}</b><span>运动打卡次数</span></div>`;content.prepend(summary);
}

function enhanceDialogs(){enhanceRecipeDialogActions();}
function enhanceAll(){
  if(enhancing)return;enhancing=true;try{setVersion();decorateNav();updateRouteUI();enhanceMenu();enhanceGroups();enhanceTomorrow();enhanceRecipes();enhanceShopping();enhancePantry();enhanceDialogs();if(location.hash==='#buddies')enhanceBuddies();}finally{enhancing=false;}
}
function scheduleEnhance(delay=70){clearTimeout(enhanceTimer);enhanceTimer=setTimeout(enhanceAll,delay)}

function observe(){
  const observer=new MutationObserver(mutations=>{if(enhancing)return;const relevant=mutations.some(m=>m.type==='childList');if(relevant)scheduleEnhance();});observer.observe(document.body,{childList:true,subtree:true});
}

async function init(){
  applyBrand();buildShell();installVersionGuard();await updateAccountChrome();
  setTimeout(()=>{renderHome();enhanceAll();},550);setTimeout(()=>{renderHome();enhanceAll();},1500);observe();
  window.addEventListener('hashchange',()=>{updateRouteUI();setVersion();scheduleEnhance(90);if(location.hash==='#home')renderHome();});
  window.addEventListener('focus',()=>{setVersion();updateAccountChrome();if(location.hash==='#home')renderHome();});
  window.addEventListener('fansfood-account-changed',()=>{updateAccountChrome();renderHome();scheduleEnhance(120);});
  window.addEventListener('fansfood-group-changed',()=>{renderHome();scheduleEnhance(120);});
  if(supabase)supabase.auth.onAuthStateChange(()=>setTimeout(()=>{updateAccountChrome();renderHome();},250));
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
