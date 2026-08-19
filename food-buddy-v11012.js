import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.SHIGUANG_CONFIG || {};
const supabase = cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY
  ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession:true, autoRefreshToken:true, storage:window.localStorage }
    })
  : null;

const ACTIVE_KEY = 'shiguang-food-buddy-active';
const BUCKET = 'food-buddy-images';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MEALS = [
  { key:'breakfast', label:'早餐', icon:'☀' },
  { key:'lunch', label:'午餐', icon:'◐' },
  { key:'dinner', label:'晚餐', icon:'◑' },
  { key:'snack', label:'加餐', icon:'●' }
];
const REACTIONS = ['❤️','😋','💪','👏'];

const state = {
  user:null,
  spaces:[],
  activeSpace:null,
  members:[],
  logs:[],
  reactions:[],
  signedUrls:new Map(),
  loading:false
};

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._buddyV11012Timer);
  el._buddyV11012Timer = setTimeout(() => el.classList.remove('show'), 2200);
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function initials(name='饭搭子') {
  const text = String(name).replace(/\s*·\s*我$/,'').trim();
  return (text.slice(0,2) || '饭友').toUpperCase();
}
function activeSpaceId() { return localStorage.getItem(ACTIVE_KEY) || ''; }
function setActiveSpaceId(id) {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}
function extensionFor(file) {
  const fromName = String(file?.name || '').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g,'');
  if (fromName && fromName.length <= 6) return fromName;
  return ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic','image/heif':'heif'})[file?.type] || 'jpg';
}
function normalizeItem(item) {
  if (!item || typeof item !== 'object') return null;
  const food = String(item.food ?? item.name ?? '').trim();
  const amount = String(item.amount ?? item.qty ?? '').trim();
  if (!food && !amount) return null;
  return { food, amount };
}
function normalizeMeal(raw) {
  if (Array.isArray(raw)) {
    const items = raw.map(normalizeItem).filter(Boolean);
    const withImage = raw.find(x => x && typeof x === 'object' && x.image_path);
    return { items, image_path:withImage?.image_path || null };
  }
  if (!raw || typeof raw !== 'object') return { items:[], image_path:null };
  if (Array.isArray(raw.items)) {
    return {
      items: raw.items.map(normalizeItem).filter(Boolean),
      image_path: raw.image_path || null
    };
  }
  const legacy = normalizeItem(raw);
  return { items:legacy ? [legacy] : [], image_path:raw.image_path || null };
}
function mealOf(log, key) { return normalizeMeal(log?.meals?.[key]); }
function foodLine(item) {
  const food = String(item?.food || '').trim();
  const amount = String(item?.amount || '').trim();
  if (!food) return amount;
  if (!amount) return food;
  return `${amount}${food}`;
}
function logOf(userId) { return state.logs.find(row => row.user_id === userId) || null; }
function signedUrl(path) { return path ? (state.signedUrls.get(path) || '') : ''; }

function ensurePage() {
  let page = $('#buddies');
  if (!page) {
    page = document.createElement('section');
    page.className = 'page';
    page.id = 'buddies';
    page.innerHTML = `
      <div class="page-title">
        <div><span class="eyebrow">FOOD BUDDIES</span><h1>饭搭子</h1><p>最多 5 位好朋友。把一天吃过的东西分餐记下来，也顺手记录有没有运动。</p></div>
      </div>
      <div id="buddyContent"></div>`;
    $('main')?.appendChild(page);
  }
  const nav = $('#nav');
  if (nav && !nav.querySelector('a[href="#buddies"]')) {
    const a = document.createElement('a');
    a.href = '#buddies';
    a.textContent = '饭搭子';
    nav.querySelector('a[href="#groups"]')?.insertAdjacentElement('afterend', a);
  }
}
function ensureHomeEntry() {
  const grid = $('#home .home-module-grid');
  if (!grid || grid.querySelector('.buddy-home-strip')) return;
  const a = document.createElement('a');
  a.href = '#buddies';
  a.className = 'home-module-card buddy-home-strip';
  a.innerHTML = `<span class="home-module-icon">○</span><div class="home-module-copy"><div class="buddy-strip-copy"><small>FOOD BUDDIES</small><h2>饭搭子</h2><p>和好朋友一起记录今天吃了什么、吃了多少、有没有运动。</p></div></div><span class="home-module-badge">朋友打卡</span><span class="home-module-arrow">→</span>`;
  const third = grid.children[2];
  third ? grid.insertBefore(a, third) : grid.appendChild(a);
}

async function loadSession() {
  if (!supabase) { state.user = null; return; }
  const { data } = await supabase.auth.getSession();
  state.user = data.session?.user || null;
}
async function loadSpaces() {
  state.spaces = [];
  state.activeSpace = null;
  if (!state.user || !supabase) return;
  const { data, error } = await supabase
    .from('food_buddy_spaces')
    .select('id,name,invite_code,owner_id,created_at')
    .order('created_at', { ascending:true });
  if (error) { console.warn('饭搭子空间读取失败', error); return; }
  state.spaces = data || [];
  const wanted = activeSpaceId();
  state.activeSpace = state.spaces.find(s => s.id === wanted) || state.spaces[0] || null;
  setActiveSpaceId(state.activeSpace?.id || '');
}
async function loadActiveData() {
  state.members = [];
  state.logs = [];
  state.reactions = [];
  state.signedUrls = new Map();
  if (!state.activeSpace || !supabase) return;
  const date = todayISO();
  const [m,l,r] = await Promise.all([
    supabase.from('food_buddy_members').select('space_id,user_id,display_name,joined_at').eq('space_id',state.activeSpace.id).order('joined_at'),
    supabase.from('food_buddy_daily_logs').select('id,space_id,user_id,log_date,meals,fitness_done,fitness_type,fitness_minutes,note,updated_at').eq('space_id',state.activeSpace.id).eq('log_date',date),
    supabase.from('food_buddy_reactions').select('id,space_id,log_date,target_user_id,reactor_user_id,emoji').eq('space_id',state.activeSpace.id).eq('log_date',date)
  ]);
  if (m.error) console.warn('饭搭子成员读取失败', m.error);
  if (l.error) console.warn('饭搭子打卡读取失败', l.error);
  if (r.error) console.warn('饭搭子互动读取失败', r.error);
  state.members = m.data || [];
  state.logs = l.data || [];
  state.reactions = r.data || [];
  const paths = new Set();
  state.logs.forEach(log => MEALS.forEach(meal => {
    const path = mealOf(log, meal.key).image_path;
    if (path) paths.add(path);
  }));
  const pairs = await Promise.all([...paths].map(async path => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    return [path, error ? '' : (data?.signedUrl || '')];
  }));
  state.signedUrls = new Map(pairs);
}

function setupHtml() {
  return `<div class="buddy-setup-grid">
    <section class="card buddy-setup-card"><span class="eyebrow">CREATE</span><h3>新建一个饭搭子</h3><p class="meal-meta">你会成为创建者。把邀请码发给朋友，最多加入 5 人。</p><form class="buddy-inline-form" id="buddyCreateForm"><input name="name" maxlength="40" placeholder="名字，可不填（默认：饭搭子）"><button class="btn primary">创建</button></form></section>
    <section class="card buddy-setup-card"><span class="eyebrow">JOIN</span><h3>加入朋友的饭搭子</h3><p class="meal-meta">输入朋友发来的 8 位邀请码。</p><form class="buddy-inline-form" id="buddyJoinForm"><input name="code" maxlength="8" required placeholder="例如 A1B2C3D4" autocapitalize="characters"><button class="btn primary">加入</button></form></section>
  </div>`;
}
function toolbarHtml() {
  return `<section class="card buddy-toolbar"><div class="buddy-toolbar-left"><select class="buddy-space-select" id="buddySpaceSelect">${state.spaces.map(s => `<option value="${s.id}" ${s.id===state.activeSpace?.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select><span class="buddy-member-count">${state.members.length}/5 人</span>${state.activeSpace ? `<span class="buddy-code">邀请码 <b>${esc(state.activeSpace.invite_code)}</b></span>` : ''}</div><div class="buddy-toolbar-actions"><button class="btn ghost" id="buddyNewBtn" type="button">＋ 新建</button><button class="btn ghost" id="buddyJoinBtn" type="button">＋ 加入</button>${state.activeSpace ? (state.activeSpace.owner_id===state.user?.id ? '<button class="btn danger" id="buddyDeleteSpace" type="button">删除这个饭搭子</button>' : '<button class="btn danger" id="buddyLeaveSpace" type="button">退出</button>') : ''}</div></section><div id="buddySetupInline" hidden>${setupHtml()}</div>`;
}
function itemEditorRow(item={food:'',amount:''}) {
  return `<div class="buddy-food-editor-row" data-buddy-food-row><input data-buddy-food value="${esc(item.food||'')}" placeholder="吃了什么，例如 糖醋排骨"><input data-buddy-amount value="${esc(item.amount||'')}" placeholder="份量，如 5块"><button type="button" class="buddy-food-remove" data-buddy-remove-food aria-label="删除这一项">×</button></div>`;
}
function mealEditorCard(meal, mine) {
  const value = mealOf(mine, meal.key);
  const rows = value.items.length ? value.items.map(itemEditorRow).join('') : itemEditorRow();
  const url = signedUrl(value.image_path);
  return `<section class="buddy-meal-row buddy-meal-module" data-meal-key="${meal.key}" data-existing-image="${esc(value.image_path||'')}">
    <div class="buddy-meal-module-head"><div><span class="buddy-meal-dot">${meal.icon}</span><b>${meal.label}</b></div><label class="buddy-photo-button"><span>${url?'更换照片':'添加照片'}</span><input type="file" data-buddy-photo accept="image/*"></label></div>
    <div class="buddy-meal-photo ${url?'has-photo':''}" data-buddy-photo-preview>${url?`<button type="button" data-buddy-open-photo="${esc(url)}"><img src="${esc(url)}" alt="${meal.label}照片"></button>`:''}<button type="button" class="buddy-photo-remove" data-buddy-remove-photo ${url?'':'hidden'}>移除照片</button></div>
    <input type="hidden" data-buddy-remove-photo-flag value="0">
    <div class="buddy-food-editor-list" data-buddy-food-list>${rows}</div>
    <button type="button" class="buddy-add-food" data-buddy-add-food>＋ 再添加一种</button>
  </section>`;
}
function editorHtml() {
  const mine = logOf(state.user?.id) || {};
  return `<section class="card buddy-checkin"><div class="buddy-checkin-head"><div><span class="eyebrow">MY CHECK-IN</span><h2>我今天吃了什么？</h2><p class="meal-meta">一顿饭可以记很多样。份量写“5块、200ml、2个、半碗”都可以。</p></div><span class="buddy-date-pill">今天</span></div><form id="buddyCheckinForm"><div class="buddy-meal-editor">${MEALS.map(meal => mealEditorCard(meal, mine)).join('')}</div><div class="buddy-fitness-row"><label><input type="checkbox" name="fitnessDone" ${mine.fitness_done?'checked':''}> 今天健身了</label><select name="fitnessType"><option value="">运动类型</option>${['力量训练','有氧','跑步','游泳','球类','散步','其他'].map(x => `<option ${mine.fitness_type===x?'selected':''}>${x}</option>`).join('')}</select><input name="fitnessMinutes" type="number" min="0" max="1440" value="${mine.fitness_minutes||''}" placeholder="分钟"><span class="meal-meta">没练就留空</span></div><textarea class="buddy-note" name="note" rows="2" maxlength="500" placeholder="今天想和饭搭子说点什么…">${esc(mine.note||'')}</textarea><div class="buddy-save-row"><button class="btn primary" type="submit">保存今日打卡</button></div></form></section>`;
}
function mealFeedHtml(log, meal) {
  const value = mealOf(log, meal.key);
  const url = signedUrl(value.image_path);
  const chips = value.items.length
    ? value.items.map(item => `<span class="buddy-food-chip">${esc(foodLine(item))}</span>`).join('')
    : '<span class="buddy-food-empty">还没记录</span>';
  return `<div class="buddy-meal-item"><div class="buddy-meal-label"><span>${meal.icon}</span><b>${meal.label}</b></div><div class="buddy-food-chips">${chips}</div>${url?`<button class="buddy-feed-photo" type="button" data-buddy-open-photo="${esc(url)}"><img src="${esc(url)}" alt="${meal.label}照片"></button>`:''}</div>`;
}
function personHtml(member) {
  const log = logOf(member.user_id);
  const me = member.user_id === state.user?.id;
  const reactionHtml = REACTIONS.map(emoji => {
    const rows = state.reactions.filter(r => r.target_user_id===member.user_id && r.emoji===emoji);
    const mine = rows.some(r => r.reactor_user_id===state.user?.id);
    return `<button class="buddy-react ${mine?'mine':''}" data-buddy-react="${member.user_id}" data-emoji="${emoji}" type="button">${emoji}${rows.length?` ${rows.length}`:''}</button>`;
  }).join('');
  return `<article class="card buddy-person ${me?'me':''}"><div class="buddy-person-head"><div class="buddy-person-name"><span class="buddy-avatar">${esc(initials(member.display_name))}</span><div><h3>${esc(member.display_name)}${me?' · 我':''}</h3><small>${me?'我的今日记录':'TA 的今日记录'}</small></div></div><span class="buddy-status-pill">${log?'今日已打卡':'还没打卡'}</span></div><div class="buddy-meal-list">${MEALS.map(meal => mealFeedHtml(log, meal)).join('')}</div><div class="buddy-fitness-summary">${log?.fitness_done ? `<b>今天运动了</b><span>${esc(log.fitness_type||'运动')}${log.fitness_minutes?` · ${log.fitness_minutes} 分钟`:''}</span>` : '<b>今天还没记录运动</b><span>休息日也没关系</span>'}</div><div class="buddy-reactions">${reactionHtml}</div></article>`;
}
function noteTickerHtml() {
  const rows = state.members.map(member => ({ member, log:logOf(member.user_id) })).filter(x => x.log?.note?.trim());
  if (!rows.length) return '';
  return `<div class="buddy-note-ticker" aria-label="今天的饭搭子留言"><div class="buddy-note-track">${rows.map(({member,log}) => `<div class="buddy-note-chip"><span>${esc(initials(member.display_name))}</span><b>${esc(member.display_name)}</b><p>${esc(log.note)}</p></div>`).join('')}</div></div>`;
}
function activeHtml() {
  return `${toolbarHtml()}${editorHtml()}<div class="buddy-section-head"><div><span class="eyebrow">TODAY TOGETHER</span><h2>今天大家吃了什么</h2></div><span class="meal-meta">${state.members.length} 位饭搭子</span></div>${noteTickerHtml()}<div class="buddy-people-grid">${state.members.map(personHtml).join('')}</div>`;
}

function ensureLightbox() {
  let dialog = $('#buddyPhotoDialogV11012');
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'buddyPhotoDialogV11012';
  dialog.innerHTML = '<button class="buddy-photo-dialog-close" type="button" aria-label="关闭">×</button><img alt="饭搭子餐食照片">';
  document.body.appendChild(dialog);
  $('.buddy-photo-dialog-close', dialog).onclick = () => dialog.close();
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  return dialog;
}
function openLightbox(url) {
  if (!url) return;
  const dialog = ensureLightbox();
  $('img', dialog).src = url;
  if (!dialog.open) dialog.showModal();
}
function bindSetup(root=document) {
  $('#buddyCreateForm', root)?.addEventListener('submit', createSpace);
  $('#buddyJoinForm', root)?.addEventListener('submit', joinSpace);
}
function bindActive() {
  $('#buddySpaceSelect')?.addEventListener('change', async e => { setActiveSpaceId(e.target.value); await refresh(); });
  const toggleSetup = () => { const el=$('#buddySetupInline'); if (el) { el.hidden=!el.hidden; if (!el.hidden) bindSetup(el); } };
  $('#buddyNewBtn')?.addEventListener('click', toggleSetup);
  $('#buddyJoinBtn')?.addEventListener('click', toggleSetup);
  $('#buddyDeleteSpace')?.addEventListener('click', deleteSpace);
  $('#buddyLeaveSpace')?.addEventListener('click', leaveSpace);
  $('#buddyCheckinForm')?.addEventListener('submit', saveCheckin);
  $('#buddyContent')?.addEventListener('click', async event => {
    const add = event.target.closest('[data-buddy-add-food]');
    if (add) {
      const list = add.closest('[data-meal-key]')?.querySelector('[data-buddy-food-list]');
      list?.insertAdjacentHTML('beforeend', itemEditorRow());
      list?.lastElementChild?.querySelector('[data-buddy-food]')?.focus();
      return;
    }
    const remove = event.target.closest('[data-buddy-remove-food]');
    if (remove) {
      const list = remove.closest('[data-buddy-food-list]');
      const rows = $$('[data-buddy-food-row]', list);
      if (rows.length <= 1) {
        const food = rows[0]?.querySelector('[data-buddy-food]');
        const amount = rows[0]?.querySelector('[data-buddy-amount]');
        if (food) food.value='';
        if (amount) amount.value='';
      } else remove.closest('[data-buddy-food-row]')?.remove();
      return;
    }
    const removePhoto = event.target.closest('[data-buddy-remove-photo]');
    if (removePhoto) {
      const card = removePhoto.closest('[data-meal-key]');
      const preview = card?.querySelector('[data-buddy-photo-preview]');
      const flag = card?.querySelector('[data-buddy-remove-photo-flag]');
      const file = card?.querySelector('[data-buddy-photo]');
      if (flag) flag.value='1';
      if (file) file.value='';
      if (preview) { preview.classList.remove('has-photo'); preview.querySelector('button[data-buddy-open-photo]')?.remove(); }
      removePhoto.hidden = true;
      return;
    }
    const open = event.target.closest('[data-buddy-open-photo]');
    if (open) { openLightbox(open.dataset.buddyOpenPhoto); return; }
    const react = event.target.closest('[data-buddy-react]');
    if (react) { await toggleReaction(react.dataset.buddyReact, react.dataset.emoji); }
  });
  $$('#buddyContent [data-buddy-photo]').forEach(input => input.addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('请选择图片文件'); event.target.value=''; return; }
    if (file.size > MAX_FILE_SIZE) { toast('单张照片不能超过 10MB'); event.target.value=''; return; }
    const card = event.target.closest('[data-meal-key]');
    const preview = card?.querySelector('[data-buddy-photo-preview]');
    const flag = card?.querySelector('[data-buddy-remove-photo-flag]');
    if (flag) flag.value='0';
    if (!preview) return;
    if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
    const url = URL.createObjectURL(file);
    preview.dataset.objectUrl = url;
    preview.classList.add('has-photo');
    preview.querySelector('button[data-buddy-open-photo]')?.remove();
    preview.insertAdjacentHTML('afterbegin', `<button type="button" data-buddy-open-photo="${esc(url)}"><img src="${esc(url)}" alt="餐食预览"></button>`);
    preview.querySelector('[data-buddy-remove-photo]').hidden = false;
  }));
}
async function render() {
  ensurePage();
  ensureHomeEntry();
  const root = $('#buddyContent');
  if (!root) return;
  if (!supabase) { root.innerHTML='<div class="card buddy-empty"><h3>云端暂不可用</h3><p>饭搭子需要登录和云端同步。</p></div>'; return; }
  if (!state.user) { root.innerHTML='<div class="card buddy-empty"><h3>登录后开启饭搭子</h3><p>点右上角头像登录。这个模块和普通群组完全独立。</p></div>'; return; }
  if (!state.spaces.length) { root.innerHTML=setupHtml(); bindSetup(root); return; }
  root.innerHTML=`<div class="buddy-shell">${activeHtml()}</div>`;
  bindActive();
}
async function refresh() {
  if (state.loading) return;
  state.loading = true;
  try {
    await loadSession();
    await loadSpaces();
    await loadActiveData();
    await render();
  } finally { state.loading = false; }
}
async function createSpace(event) {
  event.preventDefault();
  if (!state.user) return;
  const name = event.currentTarget.elements.name.value.trim() || '饭搭子';
  const btn = event.submitter;
  btn.disabled = true;
  const { data, error } = await supabase.from('food_buddy_spaces').insert({ name, owner_id:state.user.id }).select('id').single();
  btn.disabled = false;
  if (error) { toast(error.message || '创建失败'); return; }
  setActiveSpaceId(data.id);
  toast('饭搭子创建好了');
  await refresh();
}
async function joinSpace(event) {
  event.preventDefault();
  const code = event.currentTarget.elements.code.value.trim().toUpperCase();
  const btn = event.submitter;
  btn.disabled = true;
  const { data, error } = await supabase.rpc('join_food_buddy', { p_invite_code:code });
  btn.disabled = false;
  if (error) { toast(error.message?.includes('满员') ? '这个饭搭子已经满员（最多5人）' : (error.message || '加入失败')); return; }
  setActiveSpaceId(data);
  toast('加入成功');
  await refresh();
}
async function uploadMealPhoto(spaceId, userId, mealKey, file) {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件');
  if (file.size > MAX_FILE_SIZE) throw new Error('单张照片不能超过 10MB');
  const path = `${spaceId}/${userId}/${todayISO()}/${mealKey}-${Date.now()}-${crypto.randomUUID().slice(0,8)}.${extensionFor(file)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl:'3600', upsert:false, contentType:file.type || undefined });
  if (error) throw error;
  return path;
}
function editorMealItems(card) {
  return $$('[data-buddy-food-row]', card).map(row => ({
    food: $('[data-buddy-food]', row)?.value.trim() || '',
    amount: $('[data-buddy-amount]', row)?.value.trim() || ''
  })).filter(item => item.food || item.amount);
}
async function saveCheckin(event) {
  event.preventDefault();
  if (!state.activeSpace || !state.user) return;
  const form = event.currentTarget;
  const button = event.submitter;
  const originalText = button?.textContent || '保存今日打卡';
  if (button) { button.disabled=true; button.textContent='保存中…'; }
  const mine = logOf(state.user.id);
  const meals = {};
  const uploaded = [];
  const removeAfterSave = [];
  try {
    for (const meal of MEALS) {
      const card = form.querySelector(`[data-meal-key="${meal.key}"]`);
      const old = mealOf(mine, meal.key);
      const oldPath = old.image_path || null;
      const file = card?.querySelector('[data-buddy-photo]')?.files?.[0] || null;
      const remove = card?.querySelector('[data-buddy-remove-photo-flag]')?.value === '1';
      let imagePath = oldPath;
      if (remove && oldPath) { imagePath=null; removeAfterSave.push(oldPath); }
      if (file) {
        const newPath = await uploadMealPhoto(state.activeSpace.id, state.user.id, meal.key, file);
        uploaded.push(newPath);
        imagePath = newPath;
        if (oldPath && oldPath !== newPath) removeAfterSave.push(oldPath);
      }
      meals[meal.key] = { items:editorMealItems(card), image_path:imagePath };
    }
    const fitnessDone = Boolean(form.elements.fitnessDone?.checked);
    const payload = {
      space_id:state.activeSpace.id,
      user_id:state.user.id,
      log_date:todayISO(),
      meals,
      fitness_done:fitnessDone,
      fitness_type:fitnessDone ? (form.elements.fitnessType?.value || '') : '',
      fitness_minutes:fitnessDone ? Number(form.elements.fitnessMinutes?.value || 0) : 0,
      note:form.elements.note?.value.trim() || '',
      updated_at:new Date().toISOString()
    };
    const { error } = await supabase.from('food_buddy_daily_logs').upsert(payload, { onConflict:'space_id,user_id,log_date' });
    if (error) throw error;
    const oldPaths = [...new Set(removeAfterSave.filter(Boolean))];
    if (oldPaths.length) await supabase.storage.from(BUCKET).remove(oldPaths);
    toast('今天的打卡保存好了');
    await loadActiveData();
    await render();
  } catch (error) {
    if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded);
    toast(error?.message || '保存失败');
  } finally {
    if (button) { button.disabled=false; button.textContent=originalText; }
  }
}
async function toggleReaction(targetUserId, emoji) {
  if (!state.activeSpace || !state.user) return;
  const mine = state.reactions.find(r => r.target_user_id===targetUserId && r.reactor_user_id===state.user.id && r.emoji===emoji);
  if (mine) await supabase.from('food_buddy_reactions').delete().eq('id', mine.id);
  else await supabase.from('food_buddy_reactions').insert({ space_id:state.activeSpace.id, log_date:todayISO(), target_user_id:targetUserId, reactor_user_id:state.user.id, emoji });
  await loadActiveData();
  await render();
}
async function deleteSpace() {
  if (!state.activeSpace || state.activeSpace.owner_id!==state.user?.id) return;
  if (!confirm('删除这个饭搭子吗？成员和打卡记录都会一起删除。')) return;
  const { error } = await supabase.from('food_buddy_spaces').delete().eq('id', state.activeSpace.id);
  if (error) { toast(error.message || '删除失败'); return; }
  setActiveSpaceId('');
  toast('饭搭子已删除');
  await refresh();
}
async function leaveSpace() {
  if (!state.activeSpace || !state.user) return;
  if (!confirm('退出这个饭搭子吗？')) return;
  const { error } = await supabase.from('food_buddy_members').delete().eq('space_id', state.activeSpace.id).eq('user_id', state.user.id);
  if (error) { toast(error.message || '退出失败'); return; }
  setActiveSpaceId('');
  toast('已退出');
  await refresh();
}
function init() {
  ensurePage();
  ensureLightbox();
  const observer = new MutationObserver(() => ensureHomeEntry());
  observer.observe(document.body, { childList:true, subtree:true });
  setTimeout(() => { ensureHomeEntry(); refresh(); }, 700);
  window.addEventListener('hashchange', () => { if (location.hash==='#buddies') refresh(); });
  window.addEventListener('fansfood-account-changed', refresh);
  if (supabase) supabase.auth.onAuthStateChange(() => setTimeout(refresh, 180));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
else init();
