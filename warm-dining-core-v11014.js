const VERSION=window.SHIGUANG_VERSION||'1.1.014';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let homeTimer=null;

const ICONS={
  home:'<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  utensils:'<path d="M3 2v7a3 3 0 0 0 3 3V2"/><path d="M6 2v20"/><path d="M18 2v8a4 4 0 0 1-4 4V6a4 4 0 0 1 4-4Z"/><path d="M18 10v12"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar:'<path d="M8 2v4M16 2v4"/><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/>',
  book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
  cart:'<circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M3 4h2l2.4 10.4A2 2 0 0 0 9.35 16H18a2 2 0 0 0 1.94-1.52L21 8H6"/>',
  fridge:'<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M6 10h12M10 6v2M10 14v2"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>',
  chart:'<path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/>',arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  spark:'<path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M4 12a8 8 0 0 1 16 0M12 4v2M12 18v2M4 12h2M18 12h2"/>'
};
function icon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||ICONS.spark}</svg>`;}
function toast(msg){const el=$('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(el._wdCoreT);el._wdCoreT=setTimeout(()=>el.classList.remove('show'),2100);}
function readState(){try{return JSON.parse(localStorage.getItem('shiguang-v2-state')||'{}')||{}}catch{return{}}}
function initials(name='食光'){const t=String(name).replace(/^@/,'').trim();return(t.slice(0,2)||'食光').toUpperCase();}
function localISO(offset=0){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+offset);return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function tomorrowISO(){return localISO(1);}
function supabase(){return window.Shiguang?.supabase||null;}
function currentProfile(){return window.Shiguang?.profile||null;}
function currentUser(){return window.Shiguang?.user||null;}
function displayName(){const p=currentProfile();return p?.display_name?.trim()||p?.username||'食光朋友';}
function roleName(role){return role==='chef'?'大厨':role==='foodie'?'美食鉴赏家':'食光朋友';}

const navInfo={'#home':['首页','home'],'#groups':['我的群组','users'],'#buddies':['饭搭子','utensils'],'#tomorrow':['明天吃什么','clock'],'#menu':['我的七天','calendar'],'#recipes':['食谱','book'],'#shopping':['采购','cart'],'#pantry':['我的冰箱','fridge']};
function decorateNav(){
  const nav=$('#nav');if(!nav)return;
  $$('a',nav).forEach(a=>{const info=navInfo[a.getAttribute('href')];if(!info)return;const span=$('span',a);if(span&&span.textContent===info[0]&&$('svg',a))return;a.innerHTML=`${icon(info[1])}<span>${info[0]}</span>`;});
}
function buildShell(){
  if($('#wdSidebar')){decorateNav();updateRouteUI();return;}
  const topbar=$('.topbar'),nav=$('#nav');if(!topbar||!nav)return;
  const aside=document.createElement('aside');aside.className='wd-sidebar';aside.id='wdSidebar';
  aside.innerHTML=`<a class="wd-sidebar-brand" href="#home"><img src="assets/images/eating-time-mark.svg" alt=""><span><strong>食光</strong><small>Eating Time · <span id="wdSideVersion">v${VERSION}</span></small></span></a><div id="wdNavSlot"></div><div class="wd-sidebar-spacer"></div><div class="wd-sidebar-footer"><div class="wd-side-user"><span class="wd-side-avatar" id="wdSideAvatar">食光</span><div><b id="wdSideName">未登录</b><small id="wdSideRole">点击头像登录</small></div><button id="wdSideSettings" type="button" aria-label="账户设置">${icon('settings')}</button></div></div>`;
  document.body.insertBefore(aside,topbar);$('#wdNavSlot',aside).appendChild(nav);decorateNav();
  const actions=$('.top-actions',topbar);
  if(actions&&!$('#wdHeaderSearch')){
    const search=document.createElement('label');search.className='wd-header-search';search.id='wdHeaderSearch';search.innerHTML=`${icon('search')}<input id="wdGlobalSearch" type="search" placeholder="搜索菜谱、食材、想法…" aria-label="全站搜索">`;actions.insertBefore(search,actions.firstChild);
    const bell=document.createElement('button');bell.className='wd-icon-btn';bell.id='wdBell';bell.type='button';bell.innerHTML=icon('bell');bell.setAttribute('aria-label','通知');actions.insertBefore(bell,$('#accountBtn',actions));
    $('#wdBell').onclick=()=>toast('目前没有新的通知');
    $('#wdGlobalSearch').addEventListener('keydown',e=>{if(e.key!=='Enter')return;const q=e.currentTarget.value.trim();location.hash='#recipes';setTimeout(()=>{const input=$('#recipeSearch');if(input){input.value=q;input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();}},120);});
  }
  $('#wdSideSettings').onclick=()=>$('#accountBtn')?.click();
  buildMobileNav();buildActionSheet();updateAccountChrome();updateRouteUI();
  window.dispatchEvent(new CustomEvent('shiguang-shell-ready'));
}
function buildMobileNav(){
  if($('#wdMobileBottom'))return;const bar=document.createElement('nav');bar.className='wd-mobile-bottom';bar.id='wdMobileBottom';bar.innerHTML=`<a class="wd-bottom-link" href="#home" data-wd-bottom="#home">${icon('home')}<span>首页</span></a><a class="wd-bottom-link" href="#groups" data-wd-bottom="#groups">${icon('users')}<span>群组</span></a><button class="wd-bottom-plus" id="wdQuickPlus" type="button">${icon('plus')}</button><a class="wd-bottom-link" href="#recipes" data-wd-bottom="#recipes">${icon('book')}<span>菜谱</span></a><button class="wd-bottom-link" id="wdBottomAccount" type="button">${icon('user')}<span>我的</span></button>`;document.body.appendChild(bar);$('#wdQuickPlus').onclick=openSheet;$('#wdBottomAccount').onclick=()=>$('#accountBtn')?.click();
}
function buildActionSheet(){
  if($('#wdActionSheet'))return;const sheet=document.createElement('div');sheet.className='wd-sheet';sheet.id='wdActionSheet';sheet.innerHTML=`<div class="wd-sheet-panel" role="dialog" aria-modal="true"><div class="wd-sheet-handle"></div><h3>想做点什么？</h3><div class="wd-sheet-grid"><button data-wd-action="recipe">${icon('book')}发布菜谱</button><button data-wd-action="vote">${icon('chart')}查看投票</button><button data-wd-action="shopping">${icon('cart')}添加采购</button><button data-wd-action="pantry">${icon('fridge')}添加冰箱食材</button><button data-wd-action="group">${icon('users')}创建 / 加入群组</button></div></div>`;document.body.appendChild(sheet);sheet.onclick=e=>{if(e.target===sheet)closeSheet();const btn=e.target.closest('[data-wd-action]');if(btn)runQuick(btn.dataset.wdAction);};
}
function openSheet(){$('#wdActionSheet')?.classList.add('open');}function closeSheet(){$('#wdActionSheet')?.classList.remove('open');}
function runQuick(action){closeSheet();const map={vote:'#tomorrow',shopping:'#shopping',pantry:'#pantry',group:'#groups',recipe:'#recipes'};location.hash=map[action]||'#home';setTimeout(()=>{if(action==='recipe')$('#newRecipeBtn')?.click();if(action==='shopping')$('#quickAddName')?.focus();if(action==='pantry')$('#pantryName')?.focus();},140);}
function updateRouteUI(){const hash=location.hash||'#home';$$('#nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')===hash));$$('[data-wd-bottom]').forEach(a=>a.classList.toggle('active',a.dataset.wdBottom===hash));}
function updateAccountChrome(){
  const p=currentProfile(),u=currentUser();const name=u?displayName():'未登录';const role=u?roleName(p?.food_role):'点击头像登录';
  if($('#wdSideName'))$('#wdSideName').textContent=name;if($('#wdSideRole'))$('#wdSideRole').textContent=p?.username&&u?`${role} · @${p.username}`:role;if($('#wdSideAvatar'))$('#wdSideAvatar').textContent=u?initials(name):'食光';
  const account=$('#accountBtn');if(account)account.innerHTML=u?`<span class="wd-avatar" style="width:100%;height:100%">${esc(initials(name))}</span>`:icon('user');
  const sideVersion=$('#wdSideVersion');if(sideVersion)sideVersion.textContent=`v${VERSION}`;const top=$('.brand small,.app-version-static');if(top)top.textContent=`v${VERSION}`;
}

function recipeMap(){const map=new Map();$$('#recipeGrid .recipe-card').forEach(card=>{const id=$('[data-open]',card)?.dataset.open||$('[data-fav]',card)?.dataset.fav;if(!id)return;const tags=$$('.tag',card).map(x=>x.textContent.trim());map.set(id,{id,name:$('h3',card)?.textContent.trim()||'未命名菜谱',image:$('img',card)?.src||'',category:tags[0]||'',difficulty:tags[1]||''});});return map;}
function rollingDays(){const names=['周日','周一','周二','周三','周四','周五','周六'];return Array.from({length:7},(_,i)=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+i);return{key:names[d.getDay()],relative:i===0?'今天':i===1?'明天':i===2?'后天':names[d.getDay()],label:`${d.getMonth()+1}/${d.getDate()}`};});}
function dayCardsHtml(state,recipes){const slots=['早餐','午餐','晚餐'];return rollingDays().map((d,i)=>{const meals=slots.map(slot=>({slot,recipe:recipes.get(state?.plan?.[d.key]?.[slot])}));const first=meals.find(x=>x.recipe)?.recipe;return`<article class="wd-day-card ${i===0?'today':''}"><div class="wd-day-head"><b>${d.relative}</b><span>${d.label}</span></div>${first?`<div class="wd-day-cover"><img src="${esc(first.image)}" alt="${esc(first.name)}"></div>`:`<div class="wd-day-empty">今天还没有安排<a href="#menu">＋ 添加菜谱</a></div>`}<div class="wd-day-meals">${meals.map(x=>`<div class="wd-day-meal"><span>${x.slot}</span><b>${esc(x.recipe?.name||'未安排')}</b></div>`).join('')}</div></article>`;}).join('');}
function tipFromState(state){const pantry=Array.isArray(state?.pantry)?state.pantry:[];const soon=pantry.find(x=>x.expiry);if(soon)return{title:'先看看冰箱里的食材',text:`「${soon.name}」已经记录了保质日期，安排菜单时可以优先考虑。`};return{title:'好好吃饭，好好生活',text:'不用把每一餐都安排得很复杂。能和喜欢的人坐下来吃顿饭，本身就是一天里很好的时间。'};}
function recentRecipesHtml(recipes,state){const fav=new Set(state?.favorites||[]);const list=[...recipes.values()].sort((a,b)=>(fav.has(b.id)?1:0)-(fav.has(a.id)?1:0)).slice(0,3);return list.length?list.map(r=>`<button class="wd-recent-card" type="button" data-wd-recipe="${esc(r.id)}"><img src="${esc(r.image)}" alt="${esc(r.name)}"><div><b>${esc(r.name)}</b><span>${esc(r.category||'食光菜谱')}${fav.has(r.id)?' · 已收藏':''}</span></div></button>`).join(''):'<div class="empty">还没有菜谱数据。</div>';}
function baseHomeHtml(profile,state,recipes){
  const tip=tipFromState(state),name=profile?(profile.display_name?.trim()||profile.username||roleName(profile.food_role)):'食光朋友',role=profile?roleName(profile.food_role):'';
  return`<div class="wd-home-top"><div class="wd-home-greeting"><h1>${profile?`嗨，欢迎回来，${esc(name)}`:'嗨，欢迎来到食光'}</h1><p>${profile?`${role} · 今天想先从哪一项开始？`:'登录后，和家人朋友一起安排今天与明天。'}</p></div><span class="wd-home-status">云端同步中</span></div><div class="wd-core-grid"><a class="card wd-core-card groups" href="#groups" id="wdHomeGroups"><span class="wd-card-kicker">MY GROUPS</span><h2>我的群组</h2><p>进入自己的小饭桌，看看成员、群内菜谱和投票情况。</p><span class="wd-card-plate"></span><div class="wd-card-bottom"><div class="wd-card-meta"><div class="wd-avatar-stack" id="wdGroupAvatars"></div><span id="wdGroupMeta">读取群组中…</span></div><span class="wd-card-cta">进入 ${icon('arrow')}</span></div></a><a class="card wd-core-card tomorrow" href="#tomorrow" id="wdHomeTomorrow"><span class="wd-card-kicker">TOMORROW</span><h2>明天吃什么</h2><p>还没决定明天吃什么？看看大家的想法吧。</p><div class="wd-card-bottom"><div class="wd-card-meta" id="wdTomorrowMeta">读取投票中…</div><span class="wd-card-cta">去投票 ${icon('arrow')}</span></div></a><a class="card wd-core-card recipes" href="#recipes" id="wdHomeRecipe"><span class="wd-card-kicker">RECIPES</span><h2>菜谱</h2><p>收藏和分享你的拿手菜，记录你的美食灵感。</p><div class="wd-card-bottom"><div class="wd-card-meta" id="wdRecipeMeta">${recipes.size} 道可浏览菜谱</div><span class="wd-card-cta">看看菜谱 ${icon('arrow')}</span></div></a></div><section class="wd-section"><div class="wd-section-title"><div><h2>快速入口</h2><p>常用功能，一步就到。</p></div></div><div class="wd-quick-grid"><a class="wd-quick-action" href="#buddies"><span class="wd-icon-tile">${icon('users')}</span><b>饭搭子</b></a><a class="wd-quick-action" href="#shopping"><span class="wd-icon-tile">${icon('cart')}</span><b>采购</b></a><a class="wd-quick-action" href="#recipes"><span class="wd-icon-tile">${icon('heart')}</span><b>菜谱收藏</b></a><a class="wd-quick-action" href="#tomorrow"><span class="wd-icon-tile">${icon('chart')}</span><b>明日投票</b></a><a class="wd-quick-action" href="#pantry"><span class="wd-icon-tile">${icon('fridge')}</span><b>我的冰箱</b></a></div></section><section class="wd-section"><div class="wd-section-title"><div><h2>我的七天</h2><p>从今天开始，看看你自己的未来七天怎么吃。</p></div><a href="#menu">查看完整安排 →</a></div><div class="wd-seven-scroll">${dayCardsHtml(state,recipes)}</div></section><div class="wd-home-lower"><section class="card wd-tip-card"><span class="wd-tip-mark">${icon('spark')}</span><h3>${esc(tip.title)}</h3><p>${esc(tip.text)}</p></section><section><div class="wd-section-title"><div><h2>最近菜谱</h2><p>继续看看最近收藏和常用的菜。</p></div><a href="#recipes">查看更多 →</a></div><div class="wd-recent-grid">${recentRecipesHtml(recipes,state)}</div></section></div><div class="wd-home-compat" aria-hidden="true"><div id="todayMeals"></div><span id="pantryCount">0</span><span id="favoriteCount">0</span><span id="shoppingCount">0</span><span id="syncText"></span><span id="syncDot"></span></div>`;
}
async function renderHome(){
  clearTimeout(homeTimer);homeTimer=setTimeout(async()=>{const home=$('#home');if(!home)return;const active=home.classList.contains('active'),state=readState(),recipes=recipeMap();let profile=currentProfile();if(!profile&&window.Shiguang?.refreshProfile){await window.Shiguang.refreshProfile();profile=currentProfile();}home.className=`page wd-home${active?' active':''}`;home.innerHTML=baseHomeHtml(profile,state,recipes);$$('[data-wd-recipe]',home).forEach(btn=>btn.onclick=()=>$('#recipeGrid [data-open="'+CSS.escape(btn.dataset.wdRecipe)+'"]')?.click());await fillHomeCloud(recipes,state);},70);
}
async function fillHomeCloud(recipes,state){
  const sb=supabase(),u=currentUser(),status=$('.wd-home-status');if(status)status.textContent=u?'云端已连接':'登录后自动同步';const fav=new Set(state?.favorites||[]);const r=[...recipes.values()].find(x=>fav.has(x.id))||[...recipes.values()][0];if(r){const meta=$('#wdRecipeMeta');if(meta)meta.textContent=`${fav.size} 道收藏 · ${recipes.size} 道菜谱`;const card=$('#wdHomeRecipe');if(card&&!$('.wd-card-food',card)){const img=document.createElement('img');img.className='wd-card-food';img.src=r.image;img.alt='';card.appendChild(img);}}
  if(!sb||!u){if($('#wdGroupMeta'))$('#wdGroupMeta').textContent='登录后查看你的饭桌';if($('#wdTomorrowMeta'))$('#wdTomorrowMeta').textContent='登录后参与群组投票';return;}
  const {data:groups}=await sb.from('food_groups').select('id,name').order('created_at',{ascending:false});const gs=groups||[],wanted=localStorage.getItem('fansfood-active-group'),active=gs.find(g=>g.id===wanted)||gs[0];if($('#wdGroupMeta'))$('#wdGroupMeta').textContent=gs.length?`${gs.length} 个群组${active?` · ${active.name}`:''}`:'还没有加入群组';if(!active)return;
  const [{data:members},{data:dishes},{data:votes}]=await Promise.all([sb.from('group_members').select('member_name').eq('group_id',active.id).limit(5),sb.from('site_dishes').select('id,name,image_path,image_url').eq('group_id',active.id).eq('is_active',true).limit(8),sb.from('tomorrow_votes').select('id').eq('group_id',active.id).eq('target_date',tomorrowISO())]);if($('#wdGroupAvatars'))$('#wdGroupAvatars').innerHTML=(members||[]).map(m=>`<span>${esc(initials(m.member_name))}</span>`).join('');if($('#wdTomorrowMeta'))$('#wdTomorrowMeta').textContent=(dishes||[]).length?`${dishes.length} 道候选${votes?.length?` · ${votes.length} 份选择`:''}`:'大厨还没添加候选菜';
}

function enhanceMenu(){const page=$('#menu');if(!page)return;const days=rollingDays(),map=new Map(days.map(d=>[d.key,d]));$$('#weekTabs button',page).forEach(btn=>{const d=map.get(btn.dataset.day);if(d)btn.innerHTML=`<span>${d.relative}</span><small>${d.label}</small>`;});if(!page.dataset.wdTodaySelected){const b=$(`#weekTabs button[data-day="${days[0].key}"]`,page);if(b&&!b.classList.contains('active'))b.click();page.dataset.wdTodaySelected='1';}}
function enhanceGroups(){const panel=$('#activeGroupPanel');const grid=$('.group-content-grid',panel);if(!panel||!grid)return;$$('.group-module',grid).forEach(m=>{const t=$('h3',m)?.textContent||'';if(t.includes('成员'))m.dataset.wdSection='members';else if(t.includes('菜谱'))m.dataset.wdSection='recipes';else if(t.includes('采购'))m.dataset.wdSection='shopping';});if(!$('.wd-group-tabs',panel)){const tabs=document.createElement('div');tabs.className='wd-group-tabs';tabs.innerHTML=[['today','今日'],['recipes','菜谱'],['vote','投票'],['members','成员'],['shopping','采购']].map(([k,t])=>`<button type="button" data-wd-tab="${k}">${t}</button>`).join('');grid.insertAdjacentElement('beforebegin',tabs);panel.dataset.wdTab='today';$$('[data-wd-tab]',tabs).forEach(b=>b.onclick=()=>{panel.dataset.wdTab=b.dataset.wdTab;$$('[data-wd-tab]',tabs).forEach(x=>x.classList.toggle('active',x===b));});$('[data-wd-tab="today"]',tabs)?.classList.add('active');}}
function enhanceTomorrow(){const page=$('#tomorrow');if(!page)return;if($('.tomorrow-hero h1',page))$('.tomorrow-hero h1',page).textContent='明天吃什么？';if($('.tomorrow-hero p',page))$('.tomorrow-hero p',page).textContent='大家一起决定明天的菜单。每个群组的候选菜和投票彼此独立。';$$('.vote-card .vote-btn',page).forEach(b=>{if(b.textContent.trim()==='我想吃这个')b.textContent='投这一票';});}
function enhanceRecipes(){const search=$('#recipeSearch');if(search)search.placeholder='搜索菜谱、食材、想法…';$$('#recipeGrid .recipe-card').forEach(card=>{if($('.wd-recipe-author',card))return;const body=$('.recipe-body',card);if(!body)return;const row=document.createElement('div');row.className='wd-recipe-author';row.innerHTML=`<span>${$('.user-badge',card)?'我':'食'}</span>${$('.user-badge',card)?'我的菜谱':'食光精选'}`;$('.recipe-tags',body)?.insertAdjacentElement('afterend',row);});}
function enhancePantry(){const root=$('#pantryGrid');if(!root)return;const state=readState(),pantry=Array.isArray(state.pantry)?state.pantry:[];$$('.pantry-card',root).forEach((card,i)=>{if($('.wd-pantry-status',card))return;const item=pantry[i];if(!item)return;const s=document.createElement('span');s.className='wd-pantry-status';s.textContent='新鲜';card.appendChild(s);});}
function enhancePage(){updateRouteUI();updateAccountChrome();enhanceMenu();enhanceGroups();enhanceTomorrow();enhanceRecipes();enhancePantry();}
function observeTarget(selector,fn){const target=$(selector);if(!target)return;new MutationObserver(()=>setTimeout(fn,30)).observe(target,{childList:true,subtree:true});}
function installTargetedObservers(){observeTarget('#groupsPageContent',enhanceGroups);observeTarget('#recipeGrid',enhanceRecipes);observeTarget('#pantryGrid',enhancePantry);observeTarget('#weekTabs',enhanceMenu);}
function init(){
  document.body.classList.add('warm-dining');document.title='食光 · Eating Time';buildShell();renderHome();enhancePage();installTargetedObservers();
  window.addEventListener('hashchange',()=>{enhancePage();if(location.hash==='#home')renderHome();});
  window.addEventListener('fansfood-account-changed',()=>{setTimeout(()=>{updateAccountChrome();renderHome();},150);});
  window.addEventListener('fansfood-group-changed',()=>{enhanceGroups();renderHome();});
  window.addEventListener('shiguang-profile-ready',()=>{updateAccountChrome();if(location.hash==='#home')renderHome();});
  setTimeout(()=>{buildShell();enhancePage();renderHome();},800);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
