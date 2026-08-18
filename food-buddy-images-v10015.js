import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const VERSION = '1.0.015';
const BUCKET = 'food-buddy-images';
const ACTIVE_KEY = 'shiguang-food-buddy-active';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MEALS = [
  ['breakfast','早餐','🌤️'],
  ['lunch','午餐','🍚'],
  ['dinner','晚餐','🌙'],
  ['snack','加餐','🍎']
];
const cfg = window.SHIGUANG_CONFIG || {};
const supabase = cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY
  ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY)
  : null;

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
let enhancing = false;
let enhanceTimer = null;
let observer = null;

function esc(v='') {
  return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function mealValue(log, key) {
  const v = log?.meals?.[key];
  if (Array.isArray(v)) return v[0] || {};
  return v || {};
}
function toast(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._buddyImageT);
  el._buddyImageT = setTimeout(() => el.classList.remove('show'), 2100);
}
function setVersion() {
  const badge = $('.brand small');
  if (badge) badge.textContent = `v${VERSION}`;
}

function injectStyles() {
  if ($('#foodBuddyImagesV10015Styles')) return;
  const style = document.createElement('style');
  style.id = 'foodBuddyImagesV10015Styles';
  style.textContent = `
    #buddies .buddy-meal-editor{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important}
    #buddies .buddy-meal-row.buddy-meal-card-v15{display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:10px!important;padding:12px!important;border-radius:18px!important;background:#fbfcf9!important}
    .buddy-meal-card-head-v15{display:flex;align-items:center;justify-content:space-between;gap:8px}
    .buddy-meal-card-head-v15 b{font-size:13px}.buddy-photo-state-v15{font-size:10px;color:var(--muted)}
    .buddy-photo-v15{position:relative;display:grid;place-items:center;min-height:124px;aspect-ratio:16/9;border:1px dashed #d8ddd4;border-radius:14px;background:#f3f5f0;overflow:hidden}
    .buddy-photo-v15 img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .buddy-photo-actions-v15{position:relative;z-index:2;display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:center}
    .buddy-photo-v15.has-image .buddy-photo-actions-v15{position:absolute;right:8px;bottom:8px;justify-content:flex-end}
    .buddy-photo-picker-v15,.buddy-photo-remove-v15{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:7px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.82);background:rgba(255,255,255,.92);box-shadow:0 5px 14px rgba(32,39,30,.08);color:var(--ink);font-size:11px;font-weight:800;cursor:pointer}
    .buddy-photo-picker-v15 input{display:none!important}.buddy-photo-remove-v15{border:0;color:#8b514c}
    .buddy-photo-v15:not(.has-image) .buddy-photo-picker-v15{background:#fff;border:1px solid var(--line);box-shadow:none;padding:9px 13px}
    .buddy-photo-v15:not(.has-image) .buddy-photo-remove-v15{display:none}
    .buddy-fields-v15{display:grid;grid-template-columns:minmax(0,1fr) 112px;gap:8px}
    #buddies .buddy-fields-v15 input{width:100%!important;min-width:0!important;border:1px solid var(--line)!important;background:#fff!important;padding:10px 11px!important;border-radius:11px!important;text-align:left!important}
    #buddies .buddy-fields-v15 input:last-child{text-align:right!important}
    .buddy-image-help-v15{margin:2px 0 0;color:var(--muted);font-size:10px;line-height:1.5}

    #buddies .buddy-meal-item.has-photo-v15{grid-template-columns:84px 64px minmax(0,1fr) auto!important;align-items:center!important}
    .buddy-feed-photo-v15{display:block;width:84px;height:66px;padding:0;border:0;border-radius:10px;overflow:hidden;background:#eef1eb;cursor:pointer}
    .buddy-feed-photo-v15 img{width:100%;height:100%;display:block;object-fit:cover}

    #buddyPhotoDialogV15{width:min(92vw,760px);max-width:760px;padding:0;border:0;border-radius:20px;background:#111;box-shadow:0 30px 90px rgba(0,0,0,.32);overflow:hidden}
    #buddyPhotoDialogV15::backdrop{background:rgba(18,22,17,.72);backdrop-filter:blur(4px)}
    #buddyPhotoDialogV15 img{display:block;width:100%;max-height:82vh;object-fit:contain;background:#111}
    .buddy-photo-dialog-close-v15{position:absolute;top:10px;right:10px;z-index:2;width:38px;height:38px;border:0;border-radius:50%;background:rgba(255,255,255,.9);font-size:23px;line-height:1;cursor:pointer}

    @media(max-width:760px){
      #buddies .buddy-checkin{padding:15px!important;border-radius:20px!important}
      #buddies .buddy-checkin-head{margin-bottom:12px!important}
      #buddies .buddy-meal-editor{grid-template-columns:1fr!important;gap:11px!important}
      #buddies .buddy-meal-row.buddy-meal-card-v15{padding:11px!important;gap:9px!important}
      .buddy-photo-v15{min-height:168px;aspect-ratio:4/3}
      .buddy-fields-v15{grid-template-columns:minmax(0,1fr) 104px}
      #buddies .buddy-fields-v15 input{min-height:44px!important;font-size:16px!important;padding:10px 11px!important}
      #buddies .buddy-photo-picker-v15,#buddies .buddy-photo-remove-v15{min-height:40px;padding:8px 12px;font-size:12px}
      #buddies .buddy-fitness-row{grid-template-columns:1fr 1fr!important;gap:8px!important;padding:11px!important}
      #buddies .buddy-fitness-row label{grid-column:1/-1!important;min-height:42px}
      #buddies .buddy-fitness-row select,#buddies .buddy-fitness-row input{min-height:44px;font-size:15px}
      #buddies .buddy-note{font-size:16px;min-height:78px}
      #buddies .buddy-save-row .btn{width:100%;min-height:46px}
      #buddies .buddy-toolbar{padding:12px!important}
      #buddies .buddy-space-select{width:100%;min-height:44px}
      #buddies .buddy-toolbar-left{width:100%}
      #buddies .buddy-people-grid{grid-template-columns:1fr!important}
      #buddies .buddy-person{border-radius:18px!important}
      #buddies .buddy-meal-item.has-photo-v15{grid-template-columns:70px 54px minmax(0,1fr) auto!important}
      .buddy-feed-photo-v15{width:70px;height:58px}
    }
    @media(max-width:520px){
      #buddies .page-title{margin-bottom:14px}
      #buddies .page-title h1{font-size:34px}
      #buddies .buddy-checkin-head{flex-direction:column;align-items:flex-start!important}
      #buddies .buddy-date-pill{align-self:flex-start}
      .buddy-photo-v15{min-height:150px;aspect-ratio:16/11}
      .buddy-fields-v15{grid-template-columns:minmax(0,1fr) 92px;gap:6px}
      #buddies .buddy-fitness-row{grid-template-columns:1fr!important}
      #buddies .buddy-fitness-row label{grid-column:auto!important}
      #buddies .buddy-fitness-row select,#buddies .buddy-fitness-row input{width:100%}
      #buddies .buddy-fitness-row .meal-meta{display:none}
      #buddies .buddy-toolbar-actions{display:grid!important;grid-template-columns:1fr 1fr;width:100%}
      #buddies .buddy-toolbar-actions .btn{width:100%}
      #buddies .buddy-meal-item.has-photo-v15{display:grid!important;grid-template-columns:56px minmax(0,1fr) auto!important;gap:7px!important}
      .buddy-feed-photo-v15{grid-column:1/-1;width:100%;height:auto;aspect-ratio:16/9;border-radius:12px;margin-bottom:2px}
      .buddy-feed-photo-v15 img{height:100%}
      .buddy-home-strip{min-height:112px!important}
    }
  `;
  document.head.appendChild(style);
}

function ensureLightbox() {
  let dialog = $('#buddyPhotoDialogV15');
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'buddyPhotoDialogV15';
  dialog.innerHTML = '<button class="buddy-photo-dialog-close-v15" type="button" aria-label="关闭">×</button><img alt="饭搭子餐食照片">';
  document.body.appendChild(dialog);
  $('.buddy-photo-dialog-close-v15', dialog).onclick = () => dialog.close();
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  return dialog;
}
function openLightbox(url) {
  if (!url) return;
  const dialog = ensureLightbox();
  $('img', dialog).src = url;
  if (!dialog.open) dialog.showModal();
}

async function getContext() {
  if (!supabase) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  const spaceId = localStorage.getItem(ACTIVE_KEY);
  if (!user || !spaceId) return null;
  const date = todayISO();
  const [mineRes, membersRes, logsRes] = await Promise.all([
    supabase.from('food_buddy_daily_logs').select('id,space_id,user_id,log_date,meals,fitness_done,fitness_type,fitness_minutes,note').eq('space_id',spaceId).eq('user_id',user.id).eq('log_date',date).maybeSingle(),
    supabase.from('food_buddy_members').select('user_id,display_name,joined_at').eq('space_id',spaceId).order('joined_at'),
    supabase.from('food_buddy_daily_logs').select('id,user_id,meals').eq('space_id',spaceId).eq('log_date',date)
  ]);
  if (mineRes.error || membersRes.error || logsRes.error) return { user, spaceId, mine:null, members:[], logs:[], urls:new Map() };
  const paths = new Set();
  for (const log of logsRes.data || []) {
    for (const [key] of MEALS) {
      const p = mealValue(log, key).image_path;
      if (p) paths.add(p);
    }
  }
  const urlEntries = await Promise.all([...paths].map(async path => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    return [path, error ? '' : (data?.signedUrl || '')];
  }));
  return {
    user,
    spaceId,
    mine: mineRes.data || null,
    members: membersRes.data || [],
    logs: logsRes.data || [],
    urls: new Map(urlEntries)
  };
}

function makePreview(photo, url) {
  let img = $('img', photo);
  if (!url) {
    img?.remove();
    photo.classList.remove('has-image');
    return;
  }
  if (!img) {
    img = document.createElement('img');
    img.alt = '这一餐的照片';
    photo.prepend(img);
  }
  img.src = url;
  photo.classList.add('has-image');
}

function enhanceEditor(ctx) {
  const form = $('#buddyCheckinForm');
  if (!form) return;
  const rows = $$('.buddy-meal-row', form);
  rows.forEach((row, index) => {
    const [key, label, emoji] = MEALS[index] || [];
    if (!key || row.dataset.photoV15 === '1') return;
    const foodInput = form.elements[`${key}Food`];
    const amountInput = form.elements[`${key}Amount`];
    if (!foodInput || !amountInput) return;
    row.dataset.photoV15 = '1';
    row.classList.add('buddy-meal-card-v15');
    const v = mealValue(ctx.mine, key);
    const imagePath = v.image_path || '';
    const imageUrl = imagePath ? (ctx.urls.get(imagePath) || '') : '';

    const head = document.createElement('div');
    head.className = 'buddy-meal-card-head-v15';
    head.innerHTML = `<b>${emoji} ${label}</b><span class="buddy-photo-state-v15">${imagePath ? '已上传照片' : '照片可选'}</span>`;

    const photo = document.createElement('div');
    photo.className = `buddy-photo-v15${imageUrl ? ' has-image' : ''}`;
    if (imageUrl) photo.innerHTML = `<img src="${esc(imageUrl)}" alt="${esc(label)}照片">`;
    const actions = document.createElement('div');
    actions.className = 'buddy-photo-actions-v15';
    actions.innerHTML = `<label class="buddy-photo-picker-v15"><span>${imageUrl ? '📷 更换照片' : '＋ 添加照片'}</span><input type="file" name="${key}Photo" accept="image/*"></label><button class="buddy-photo-remove-v15" type="button">移除</button>`;
    photo.appendChild(actions);

    const removeFlag = document.createElement('input');
    removeFlag.type = 'hidden';
    removeFlag.name = `${key}RemovePhoto`;
    removeFlag.value = '0';

    const fields = document.createElement('div');
    fields.className = 'buddy-fields-v15';
    fields.append(foodInput, amountInput);

    row.replaceChildren(head, photo, fields, removeFlag);
    const fileInput = form.elements[`${key}Photo`];
    const pickerText = $('.buddy-photo-picker-v15 span', photo);
    const removeBtn = $('.buddy-photo-remove-v15', photo);
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast('请选择图片文件');
        fileInput.value = '';
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast('单张照片不能超过 10MB');
        fileInput.value = '';
        return;
      }
      if (photo.dataset.objectUrl) URL.revokeObjectURL(photo.dataset.objectUrl);
      const objectUrl = URL.createObjectURL(file);
      photo.dataset.objectUrl = objectUrl;
      removeFlag.value = '0';
      makePreview(photo, objectUrl);
      pickerText.textContent = '📷 更换照片';
      $('.buddy-photo-state-v15', head).textContent = '待上传';
    });
    removeBtn.addEventListener('click', () => {
      removeFlag.value = '1';
      fileInput.value = '';
      if (photo.dataset.objectUrl) URL.revokeObjectURL(photo.dataset.objectUrl);
      delete photo.dataset.objectUrl;
      makePreview(photo, '');
      pickerText.textContent = '＋ 添加照片';
      $('.buddy-photo-state-v15', head).textContent = '保存后移除';
    });
  });
  if (!form.querySelector('.buddy-image-help-v15')) {
    const help = document.createElement('p');
    help.className = 'buddy-image-help-v15';
    help.textContent = '照片只对这个饭搭子的成员可见；每餐最多 1 张，单张不超过 10MB。';
    const editor = $('.buddy-meal-editor', form);
    editor?.insertAdjacentElement('afterend', help);
  }
}

function enhanceFeed(ctx) {
  const cards = $$('#buddyContent .buddy-person');
  cards.forEach((card, memberIndex) => {
    const member = ctx.members[memberIndex];
    if (!member) return;
    const log = ctx.logs.find(row => row.user_id === member.user_id);
    const items = $$('.buddy-meal-item', card);
    items.forEach((item, mealIndex) => {
      const [key] = MEALS[mealIndex] || [];
      if (!key || item.dataset.photoV15 === '1') return;
      item.dataset.photoV15 = '1';
      const path = mealValue(log, key).image_path;
      const url = path ? ctx.urls.get(path) : '';
      if (!url) return;
      item.classList.add('has-photo-v15');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'buddy-feed-photo-v15';
      button.setAttribute('aria-label', '查看餐食大图');
      button.innerHTML = `<img src="${esc(url)}" alt="餐食照片">`;
      button.onclick = () => openLightbox(url);
      item.prepend(button);
    });
  });
}

async function enhanceNow() {
  if (enhancing) return;
  const root = $('#buddyContent');
  if (!root) { setVersion(); return; }
  enhancing = true;
  try {
    setVersion();
    const ctx = await getContext();
    if (!ctx) return;
    enhanceEditor(ctx);
    enhanceFeed(ctx);
  } catch (error) {
    console.warn('饭搭子图片增强失败', error);
  } finally {
    enhancing = false;
    setVersion();
  }
}
function scheduleEnhance(delay=80) {
  clearTimeout(enhanceTimer);
  enhanceTimer = setTimeout(enhanceNow, delay);
}

function extensionFor(file) {
  const fromName = String(file.name || '').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g,'');
  if (fromName && fromName.length <= 6) return fromName;
  const byType = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic','image/heif':'heif'};
  return byType[file.type] || 'jpg';
}
async function uploadMealPhoto(spaceId, userId, key, file) {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件');
  if (file.size > MAX_FILE_SIZE) throw new Error('单张照片不能超过 10MB');
  const path = `${spaceId}/${userId}/${todayISO()}/${key}-${Date.now()}-${crypto.randomUUID().slice(0,8)}.${extensionFor(file)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl:'3600', upsert:false, contentType:file.type || undefined });
  if (error) throw error;
  return path;
}

async function saveCheckinWithImages(form, submitter) {
  if (!supabase) return;
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  const spaceId = localStorage.getItem(ACTIVE_KEY);
  if (!user || !spaceId) { toast('请先登录并进入一个饭搭子'); return; }

  const originalText = submitter?.textContent || '保存今日打卡';
  if (submitter) { submitter.disabled = true; submitter.textContent = '上传并保存中…'; }
  const uploadedThisRun = [];
  const deleteAfterSave = [];
  try {
    const { data: existing, error: readError } = await supabase
      .from('food_buddy_daily_logs')
      .select('meals')
      .eq('space_id', spaceId)
      .eq('user_id', user.id)
      .eq('log_date', todayISO())
      .maybeSingle();
    if (readError) throw readError;

    const meals = { ...(existing?.meals || {}) };
    for (const [key] of MEALS) {
      const old = mealValue(existing, key);
      const oldPath = old.image_path || null;
      const file = form.elements[`${key}Photo`]?.files?.[0] || null;
      const remove = form.elements[`${key}RemovePhoto`]?.value === '1';
      let imagePath = oldPath;
      if (remove && oldPath) {
        imagePath = null;
        deleteAfterSave.push(oldPath);
      }
      if (file) {
        const newPath = await uploadMealPhoto(spaceId, user.id, key, file);
        uploadedThisRun.push(newPath);
        imagePath = newPath;
        if (oldPath && oldPath !== newPath) deleteAfterSave.push(oldPath);
      }
      meals[key] = {
        ...old,
        food: form.elements[`${key}Food`]?.value.trim() || '',
        amount: form.elements[`${key}Amount`]?.value.trim() || '',
        image_path: imagePath
      };
    }

    const fitnessDone = Boolean(form.elements.fitnessDone?.checked);
    const payload = {
      space_id: spaceId,
      user_id: user.id,
      log_date: todayISO(),
      meals,
      fitness_done: fitnessDone,
      fitness_type: fitnessDone ? (form.elements.fitnessType?.value || '') : '',
      fitness_minutes: fitnessDone ? Number(form.elements.fitnessMinutes?.value || 0) : 0,
      note: form.elements.note?.value.trim() || '',
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('food_buddy_daily_logs').upsert(payload, { onConflict:'space_id,user_id,log_date' });
    if (error) throw error;

    const uniqueOld = [...new Set(deleteAfterSave.filter(Boolean))];
    if (uniqueOld.length) await supabase.storage.from(BUCKET).remove(uniqueOld);
    toast('今天的打卡和照片都保存好了');
    setTimeout(() => window.dispatchEvent(new CustomEvent('fansfood-account-changed')), 80);
  } catch (error) {
    if (uploadedThisRun.length) await supabase.storage.from(BUCKET).remove(uploadedThisRun);
    toast(error?.message || '保存失败');
  } finally {
    if (submitter) { submitter.disabled = false; submitter.textContent = originalText; }
  }
}

function interceptSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== 'buddyCheckinForm') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  saveCheckinWithImages(form, event.submitter);
}

function init() {
  injectStyles();
  ensureLightbox();
  setVersion();
  document.addEventListener('submit', interceptSubmit, true);
  observer = new MutationObserver(() => {
    if (!enhancing && $('#buddyContent')) scheduleEnhance(120);
  });
  observer.observe(document.body, { childList:true, subtree:true });
  window.addEventListener('hashchange', () => { setVersion(); if (location.hash === '#buddies') scheduleEnhance(180); });
  window.addEventListener('focus', () => { setVersion(); if (location.hash === '#buddies') scheduleEnhance(120); });
  window.addEventListener('fansfood-account-changed', () => scheduleEnhance(260));
  if (supabase) supabase.auth.onAuthStateChange(() => scheduleEnhance(320));
  setTimeout(() => scheduleEnhance(100), 1200);
  setTimeout(setVersion, 2200);
}

init();