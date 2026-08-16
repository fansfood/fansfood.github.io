import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const SCHEDULE_KEY = 'shiguang-shopping-dates';
const MAIN_STATE_KEY = 'shiguang-v2-state';
const cfg = window.SHIGUANG_CONFIG || {};
const supabase = cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY
  ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY)
  : null;

let enhancing = false;
let syncTimer = null;
let lastEntries = [];

function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._shoppingScheduleTimer);
  el._shoppingScheduleTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

function localDateISO(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateMeta(value) {
  if (!value) return { title: '未安排日期', subtitle: '还没决定哪天买，就先放在这里' };
  const d = new Date(`${value}T00:00:00`);
  const weekdays = ['周日','周一','周二','周三','周四','周五','周六'];
  let prefix = '';
  if (value === localDateISO(0)) prefix = '今天 · ';
  else if (value === localDateISO(1)) prefix = '明天 · ';
  else if (value === localDateISO(2)) prefix = '后天 · ';
  return {
    title: `${prefix}${d.getMonth() + 1}月${d.getDate()}日`,
    subtitle: weekdays[d.getDay()]
  };
}

function emptySchedule() {
  return { version: 2, sections: [], assignments: {} };
}

function migrateLegacy(raw) {
  if (raw?.version === 2 && Array.isArray(raw.sections) && raw.assignments) return raw;
  const next = emptySchedule();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return next;
  const byDate = new Map();
  Object.entries(raw).forEach(([itemId, date]) => {
    if (!date || typeof date !== 'string') return;
    let sectionId = byDate.get(date);
    if (!sectionId) {
      sectionId = `date:${date}`;
      byDate.set(date, sectionId);
      next.sections.push({ id: sectionId, date });
    }
    next.assignments[itemId] = sectionId;
  });
  return next;
}

function readSchedule() {
  try {
    return migrateLegacy(JSON.parse(localStorage.getItem(SCHEDULE_KEY) || 'null'));
  } catch {
    return emptySchedule();
  }
}

function writeSchedule(schedule) {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
}

function readMainState() {
  try { return JSON.parse(localStorage.getItem(MAIN_STATE_KEY) || '{}') || {}; }
  catch { return {}; }
}

async function syncScheduleToCloud() {
  if (!supabase) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return;
    const { error } = await supabase.from('app_state').upsert({
      user_id: user.id,
      shopping_dates: readSchedule(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    if (error) console.warn('shopping schedule sync failed', error);
  }, 250);
}

function persistSchedule(schedule, message = '') {
  writeSchedule(schedule);
  syncScheduleToCloud();
  if (message) toast(message);
}

function categoryFromSection(section) {
  const text = $('h3', section)?.textContent.trim() || '其他';
  const i = text.indexOf(' ');
  return i >= 0 ? text.slice(i + 1).trim() : text;
}

function categoryEmoji(category) {
  return ({'肉蛋':'🥩','蔬菜':'🥬','水果':'🍎','乳制品':'🥛','主食':'🍚','调味料':'🧂','其他':'🛒'})[category] || '🛒';
}

function injectStyles() {
  if ($('#shoppingScheduleStyles')) return;
  const style = document.createElement('style');
  style.id = 'shoppingScheduleStyles';
  style.textContent = `
    .shopping-groups{display:grid!important;grid-template-columns:1fr!important;gap:18px!important}
    .shopping-schedule-bar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:14px 0 18px;padding:16px 18px;background:#fafbf8;border:1px dashed var(--line);border-radius:17px}
    .shopping-schedule-bar p{margin:3px 0 0;color:var(--muted);font-size:13px;line-height:1.55}.shopping-schedule-bar b{font-size:14px}
    .schedule-create{display:none;align-items:end;gap:8px;flex-wrap:wrap;margin:0 0 18px;padding:16px;border:1px solid var(--line);border-radius:17px;background:#fff}
    .schedule-create.open{display:flex}.schedule-create label{display:grid;gap:6px;font-size:12px;font-weight:700;color:var(--muted)}
    .schedule-create input{border:1px solid var(--line);background:#fbfcf9;padding:11px 12px;border-radius:12px;outline:none;color:var(--ink)}
    .schedule-shortcuts{display:flex;gap:6px;flex-wrap:wrap}.schedule-shortcuts button{border:1px solid var(--line);background:#f4f5f1;padding:9px 12px;border-radius:11px;font-size:12px;font-weight:700}
    .shopping-date-group{padding:20px}.shopping-date-group.unscheduled{border-style:dashed}.shopping-date-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:8px}
    .shopping-date-title{display:flex;align-items:flex-start;gap:10px}.shopping-date-title>span{font-size:22px}.shopping-date-title h3{margin:0;font-size:21px}.shopping-date-title p{margin:4px 0 0;color:var(--muted);font-size:12px}
    .shopping-date-head-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end}.shopping-date-count{font-size:12px;color:var(--muted);background:#f1f2ed;padding:6px 9px;border-radius:99px}
    .shopping-date-items{display:grid}.shopping-date-group .shopping-item{display:grid;grid-template-columns:24px minmax(130px,1fr) auto auto auto;gap:10px;align-items:center}
    .shopping-category-chip{font-size:11px;color:#62675f;background:#f1f2ed;padding:5px 8px;border-radius:99px;white-space:nowrap}
    .schedule-add-form{display:grid;grid-template-columns:1fr 130px auto;gap:8px;margin-top:14px;padding-top:14px;border-top:1px dashed var(--line)}
    .schedule-add-form input{border:1px solid var(--line);background:#fbfcf9;padding:10px 11px;border-radius:11px;outline:none;min-width:0}
    .schedule-empty{padding:18px 4px;color:var(--muted);font-size:13px}.schedule-hidden-base{display:none!important}
    .schedule-picker{width:min(620px,92vw);border:0;border-radius:22px;padding:0;box-shadow:0 32px 100px rgba(22,28,20,.28)}.schedule-picker::backdrop{background:rgba(21,27,20,.42);backdrop-filter:blur(5px)}
    .schedule-picker-inner{padding:28px}.schedule-picker-inner h2{margin:5px 0 6px}.schedule-picker-inner>p{margin:0 0 18px;color:var(--muted);font-size:13px}.schedule-picker-list{display:grid;gap:7px;max-height:48vh;overflow:auto}
    .schedule-picker-item{display:grid;grid-template-columns:22px 1fr auto;gap:10px;align-items:center;padding:11px;border:1px solid var(--line);border-radius:13px}.schedule-picker-item span{font-size:12px;color:var(--muted)}
    .schedule-picker-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
    @media(max-width:700px){.shopping-schedule-bar{align-items:flex-start;flex-direction:column}.schedule-create{align-items:stretch;flex-direction:column}.schedule-create .btn{width:100%}.shopping-date-head{flex-direction:column}.shopping-date-head-actions{justify-content:flex-start}.shopping-date-group .shopping-item{grid-template-columns:24px 1fr auto}.shopping-category-chip{grid-column:2}.shopping-date-group .shopping-item>.icon-btn{grid-column:3;grid-row:2}.schedule-add-form{grid-template-columns:1fr}.schedule-picker-item{grid-template-columns:22px 1fr}.schedule-picker-item span{grid-column:2}}
  `;
  document.head.appendChild(style);
}

function ensureTopControls() {
  const toolbar = $('.shopping-toolbar');
  if (!toolbar || $('#shoppingScheduleBar')) return;

  const bar = document.createElement('div');
  bar.id = 'shoppingScheduleBar';
  bar.className = 'shopping-schedule-bar';
  bar.innerHTML = `
    <div><b>📅 按“哪天去买”整理采购</b><p>日期属于整张采购清单，不属于某一件商品。不想安排日期的东西继续放在“未安排日期”。</p></div>
    <button class="btn primary" id="newShoppingDayBtn" type="button">＋ 新建采购日</button>`;

  const create = document.createElement('div');
  create.id = 'shoppingScheduleCreate';
  create.className = 'schedule-create';
  create.innerHTML = `
    <label>这次哪天去采购？<input id="shoppingScheduleDate" type="date"></label>
    <div class="schedule-shortcuts"><button type="button" data-schedule-offset="1">明天</button><button type="button" data-schedule-offset="2">后天</button></div>
    <button class="btn primary" id="confirmShoppingDay" type="button">建立这天的清单</button>
    <button class="btn ghost" id="cancelShoppingDay" type="button">取消</button>`;

  toolbar.insertAdjacentElement('afterend', create);
  toolbar.insertAdjacentElement('afterend', bar);

  $('#newShoppingDayBtn').onclick = () => create.classList.toggle('open');
  $('#cancelShoppingDay').onclick = () => create.classList.remove('open');
  $$('[data-schedule-offset]', create).forEach(button => {
    button.onclick = () => { $('#shoppingScheduleDate').value = localDateISO(Number(button.dataset.scheduleOffset)); };
  });
  $('#confirmShoppingDay').onclick = createDateSection;

  const quickForm = $('#quickAddForm');
  if (quickForm) {
    $('#quickAddName').placeholder = '添加到“未安排日期”';
  }
}

function createDateSection() {
  const input = $('#shoppingScheduleDate');
  const date = input?.value || '';
  if (!date) {
    toast('请选择采购日期；不确定日期的商品直接放在“未安排日期”即可');
    return;
  }
  const schedule = readSchedule();
  let section = schedule.sections.find(s => s.date === date);
  if (!section) {
    section = { id: `day:${crypto.randomUUID()}`, date };
    schedule.sections.push(section);
    schedule.sections.sort((a,b) => a.date.localeCompare(b.date));
    persistSchedule(schedule, '采购日已经建立');
  } else {
    toast('这个日期已经有采购清单了');
  }
  input.value = '';
  $('#shoppingScheduleCreate')?.classList.remove('open');
  enhanceShopping(true);
}

function decorateItem(item, category) {
  const checkbox = $('[data-check]', item);
  const id = checkbox?.dataset.check;
  if (!id) return null;
  item.dataset.shoppingId = id;
  item.dataset.category = category || item.dataset.category || '其他';
  if (!$('.shopping-category-chip', item)) {
    const chip = document.createElement('span');
    chip.className = 'shopping-category-chip';
    chip.textContent = `${categoryEmoji(item.dataset.category)} ${item.dataset.category}`;
    $('.qty', item)?.insertAdjacentElement('afterend', chip);
  }
  return { id, node: item, category: item.dataset.category };
}

function extractBaseEntries(root) {
  const entries = [];
  const rawSections = $$('.shopping-group', root);
  if (rawSections.length) {
    rawSections.forEach(section => {
      const category = categoryFromSection(section);
      $$('.shopping-item', section).forEach(item => {
        const entry = decorateItem(item, category);
        if (entry) entries.push(entry);
      });
    });
    return entries;
  }
  $$('.shopping-item', root).forEach(item => {
    const entry = decorateItem(item, item.dataset.category || '其他');
    if (entry) entries.push(entry);
  });
  return entries;
}

function cleanAssignments(schedule, entryIds) {
  const sectionIds = new Set(schedule.sections.map(s => s.id));
  Object.keys(schedule.assignments).forEach(itemId => {
    if (!entryIds.has(itemId) || !sectionIds.has(schedule.assignments[itemId])) delete schedule.assignments[itemId];
  });
  return schedule;
}

function createSectionCard(section, entries, isUnscheduled = false) {
  const meta = dateMeta(section?.date || '');
  const card = document.createElement('section');
  card.className = `card shopping-date-group${isUnscheduled ? ' unscheduled' : ''}`;
  card.dataset.scheduleSection = section?.id || 'unscheduled';

  const head = document.createElement('div');
  head.className = 'shopping-date-head';
  head.innerHTML = `
    <div class="shopping-date-title"><span>${isUnscheduled ? '🗒️' : '📅'}</span><div><h3>${meta.title}</h3><p>${meta.subtitle}</p></div></div>
    <div class="shopping-date-head-actions"><span class="shopping-date-count">${entries.length} 项</span>${isUnscheduled ? '' : '<button class="btn ghost schedule-pick-existing" type="button">从待安排清单加入</button><button class="btn danger schedule-delete-day" type="button">删除这天</button>'}</div>`;

  const items = document.createElement('div');
  items.className = 'shopping-date-items';
  if (entries.length) entries.forEach(entry => items.appendChild(entry.node));
  else items.innerHTML = `<div class="schedule-empty">${isUnscheduled ? '暂时没有未安排的商品。' : '这天还没有要买的东西，可以直接在下面添加。'}</div>`;

  card.append(head, items);

  if (!isUnscheduled) {
    const form = document.createElement('form');
    form.className = 'schedule-add-form';
    form.innerHTML = '<input name="name" required placeholder="这天要买什么"><input name="qty" required placeholder="数量，如 2 个"><button class="btn primary" type="submit">添加到这天</button>';
    form.onsubmit = event => addManualToSection(event, section.id);
    card.appendChild(form);

    $('.schedule-pick-existing', card).onclick = () => openUnscheduledPicker(section.id);
    $('.schedule-delete-day', card).onclick = () => deleteDateSection(section.id, section.date);
  }
  return card;
}

function enhanceShopping(force = false) {
  if (enhancing) return;
  const root = $('#shoppingGroups');
  if (!root) return;

  const rawSections = $$('.shopping-group', root);
  if (!rawSections.length && !force) {
    const current = $$('.shopping-date-group', root);
    if (current.length) return;
  }

  const extracted = rawSections.length ? extractBaseEntries(root) : lastEntries;
  if (extracted.length || rawSections.length) lastEntries = extracted;
  const entries = lastEntries;

  enhancing = true;
  try {
    let schedule = readSchedule();
    const ids = new Set(entries.map(e => e.id));
    schedule = cleanAssignments(schedule, ids);
    writeSchedule(schedule);

    const byId = new Map(entries.map(e => [e.id, e]));
    const assigned = new Set();
    const cards = [];
    [...schedule.sections].sort((a,b) => a.date.localeCompare(b.date)).forEach(section => {
      const sectionEntries = [];
      Object.entries(schedule.assignments).forEach(([itemId, sectionId]) => {
        if (sectionId === section.id && byId.has(itemId)) {
          sectionEntries.push(byId.get(itemId));
          assigned.add(itemId);
        }
      });
      cards.push(createSectionCard(section, sectionEntries, false));
    });
    const unscheduled = entries.filter(e => !assigned.has(e.id));
    cards.push(createSectionCard(null, unscheduled, true));
    root.replaceChildren(...cards);
  } finally {
    enhancing = false;
  }
}

function addManualToSection(event, sectionId) {
  event.preventDefault();
  const form = event.currentTarget;
  const name = form.elements.name.value.trim();
  const qty = form.elements.qty.value.trim();
  if (!name || !qty) return;
  const quick = $('#quickAddForm');
  if (!quick) return;

  const before = new Set((readMainState().manualShopping || []).map(x => x.id));
  $('#quickAddName').value = name;
  $('#quickAddQty').value = qty;
  quick.requestSubmit();
  form.reset();

  const attach = (attempt = 0) => {
    const manual = readMainState().manualShopping || [];
    const created = [...manual].reverse().find(x => !before.has(x.id));
    if (created) {
      const schedule = readSchedule();
      schedule.assignments[created.id] = sectionId;
      persistSchedule(schedule);
      setTimeout(() => enhanceShopping(true), 30);
      return;
    }
    if (attempt < 8) setTimeout(() => attach(attempt + 1), 60);
  };
  setTimeout(() => attach(), 30);
}

function ensurePickerDialog() {
  let dialog = $('#shoppingSchedulePicker');
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'shoppingSchedulePicker';
  dialog.className = 'schedule-picker';
  dialog.innerHTML = '<div class="schedule-picker-inner"><span class="eyebrow">MOVE TO THIS DAY</span><h2>从待安排清单加入</h2><p>一次可以勾选多样商品，它们会一起移动到这个采购日。</p><div class="schedule-picker-list"></div><div class="schedule-picker-actions"><button class="btn ghost picker-cancel" type="button">取消</button><button class="btn primary picker-confirm" type="button">加入这天</button></div></div>';
  document.body.appendChild(dialog);
  $('.picker-cancel', dialog).onclick = () => dialog.close();
  return dialog;
}

function openUnscheduledPicker(sectionId) {
  const schedule = readSchedule();
  const assigned = new Set(Object.keys(schedule.assignments));
  const candidates = lastEntries.filter(e => !assigned.has(e.id));
  if (!candidates.length) {
    toast('“未安排日期”里没有可加入的商品');
    return;
  }
  const dialog = ensurePickerDialog();
  const list = $('.schedule-picker-list', dialog);
  list.innerHTML = candidates.map(e => `<label class="schedule-picker-item"><input type="checkbox" value="${e.id}"><b>${$('.item-name', e.node)?.textContent.trim() || '商品'}</b><span>${$('.qty', e.node)?.textContent.trim() || ''}</span></label>`).join('');
  $('.picker-confirm', dialog).onclick = () => {
    const picked = $$('input[type="checkbox"]:checked', list).map(i => i.value);
    if (!picked.length) {
      toast('请先勾选要加入的商品');
      return;
    }
    const next = readSchedule();
    picked.forEach(id => { next.assignments[id] = sectionId; });
    persistSchedule(next, `已加入 ${picked.length} 项`);
    dialog.close();
    enhanceShopping(true);
  };
  dialog.showModal();
}

function deleteDateSection(sectionId, date) {
  const meta = dateMeta(date);
  if (!confirm(`删除“${meta.title}”这张采购清单吗？里面的商品会回到“未安排日期”，不会被删除。`)) return;
  const schedule = readSchedule();
  schedule.sections = schedule.sections.filter(s => s.id !== sectionId);
  Object.keys(schedule.assignments).forEach(itemId => {
    if (schedule.assignments[itemId] === sectionId) delete schedule.assignments[itemId];
  });
  persistSchedule(schedule, '这天的商品已移回未安排日期');
  enhanceShopping(true);
}

async function pullCloudSchedule() {
  if (!supabase) return;
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return;
  const { data, error } = await supabase.from('app_state').select('shopping_dates').eq('user_id', user.id).maybeSingle();
  if (error || !data?.shopping_dates) return;
  const remote = migrateLegacy(data.shopping_dates);
  writeSchedule(remote);
  enhanceShopping(true);
}

function init() {
  injectStyles();
  ensureTopControls();
  const badge = $('.brand small');
  if (badge) badge.textContent = 'v1.0.007';

  const root = $('#shoppingGroups');
  if (root) {
    const initial = extractBaseEntries(root);
    if (initial.length) lastEntries = initial;
    enhanceShopping(true);
    new MutationObserver(() => {
      if (enhancing) return;
      const raw = $$('.shopping-group', root);
      if (raw.length) {
        lastEntries = extractBaseEntries(root);
        setTimeout(() => enhanceShopping(true), 0);
      }
    }).observe(root, { childList: true, subtree: true });
  }

  window.addEventListener('hashchange', () => {
    if (location.hash === '#shopping') setTimeout(() => {
      ensureTopControls();
      enhanceShopping(true);
    }, 0);
  });

  if (supabase) {
    supabase.auth.onAuthStateChange(() => setTimeout(pullCloudSchedule, 250));
    setTimeout(pullCloudSchedule, 700);
  }
}

init();
