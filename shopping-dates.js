import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const DATE_KEY = 'shiguang-shopping-dates';
const MAIN_STATE_KEY = 'shiguang-v2-state';
const cfg = window.SHIGUANG_CONFIG || {};
const supabase = cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY
  ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY)
  : null;
let enhancing = false;
let syncTimer = null;

function injectStyles() {
  if ($('#shoppingDatesStyles')) return;
  const style = document.createElement('style');
  style.id = 'shoppingDatesStyles';
  style.textContent = `
    .shopping-date-note{margin:14px 0 4px;padding:13px 16px;border:1px dashed var(--line);border-radius:15px;color:var(--muted);font-size:13px;background:#fafbf8;display:flex;gap:8px;align-items:center}
    .quick-add{grid-template-columns:minmax(140px,1fr) 120px 170px auto!important;align-items:end}
    .quick-date-field{display:grid;gap:5px;font-size:11px;color:var(--muted);font-weight:700}
    .quick-date-field input,.shopping-date-control input{border:1px solid var(--line);background:#fbfcf9;padding:10px 9px;border-radius:11px;outline:none;color:var(--ink);min-width:0}
    .shopping-groups{display:grid!important;grid-template-columns:1fr!important;gap:18px!important}
    .shopping-date-group{padding:20px}
    .shopping-date-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
    .shopping-date-title{display:flex;align-items:center;gap:10px}
    .shopping-date-title h3{margin:0;font-size:20px}
    .shopping-date-title span{font-size:12px;color:var(--muted)}
    .shopping-date-count{font-size:12px;color:var(--muted);background:#f1f2ed;padding:6px 9px;border-radius:99px}
    .shopping-date-items{display:grid}
    .shopping-date-group .shopping-item{display:grid;grid-template-columns:24px minmax(110px,1fr) auto auto minmax(175px,auto) auto;gap:10px;align-items:center}
    .shopping-category-chip{font-size:11px;color:#62675f;background:#f1f2ed;padding:5px 8px;border-radius:99px;white-space:nowrap}
    .shopping-date-control{display:flex;align-items:center;gap:5px}
    .shopping-date-control>span{display:none}
    .shopping-date-control input{width:150px;padding:7px 8px;font-size:12px}
    .shopping-date-clear{border:0;background:#f1f2ed;width:28px;height:28px;border-radius:9px;color:var(--muted);padding:0}
    .shopping-date-clear:hover{color:var(--danger)}
    .shopping-date-group.unscheduled{border-style:dashed}
    @media(max-width:900px){.quick-add{grid-template-columns:1fr 110px 160px auto!important}.shopping-date-group .shopping-item{grid-template-columns:24px minmax(100px,1fr) auto minmax(150px,auto);}.shopping-category-chip{grid-column:2}.shopping-date-control{grid-column:4}.shopping-date-group .shopping-item>.icon-btn{grid-column:4}}
    @media(max-width:600px){.quick-add{grid-template-columns:1fr!important}.shopping-date-group{padding:16px}.shopping-date-head{align-items:flex-start}.shopping-date-group .shopping-item{grid-template-columns:24px 1fr auto;gap:8px;padding:14px 0}.shopping-item .qty{grid-column:3}.shopping-category-chip{grid-column:2}.shopping-date-control{grid-column:2/4;width:100%}.shopping-date-control input{width:100%;flex:1}.shopping-date-group .shopping-item>.icon-btn{grid-column:3;grid-row:2}.shopping-date-note{align-items:flex-start}}
  `;
  document.head.appendChild(style);
}

function readDates() {
  try { return JSON.parse(localStorage.getItem(DATE_KEY) || '{}') || {}; }
  catch { return {}; }
}

function writeDates(dates) {
  localStorage.setItem(DATE_KEY, JSON.stringify(dates));
}

function readMainState() {
  try { return JSON.parse(localStorage.getItem(MAIN_STATE_KEY) || '{}') || {}; }
  catch { return {}; }
}

function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._shoppingDateTimer);
  el._shoppingDateTimer = setTimeout(() => el.classList.remove('show'), 1700);
}

function categoryFromSection(section) {
  const text = $('h3', section)?.textContent.trim() || '其他';
  const firstSpace = text.indexOf(' ');
  return firstSpace >= 0 ? text.slice(firstSpace + 1).trim() : text;
}

function categoryEmoji(category) {
  return ({'肉蛋':'🥩','蔬菜':'🥬','水果':'🍎','乳制品':'🥛','主食':'🍚','调味料':'🧂','其他':'🛒'})[category] || '🛒';
}

function localDateISO(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateLabel(value) {
  if (!value) return { title: '未安排日期', subtitle: '日期可选，之后再决定也可以' };
  const d = new Date(`${value}T00:00:00`);
  const weekdays = ['周日','周一','周二','周三','周四','周五','周六'];
  let prefix = '';
  if (value === localDateISO(0)) prefix = '今天 · ';
  else if (value === localDateISO(1)) prefix = '明天 · ';
  return { title: `${prefix}${d.getMonth()+1}月${d.getDate()}日`, subtitle: weekdays[d.getDay()] };
}

async function syncDatesToCloud() {
  if (!supabase) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return;
    const dates = readDates();
    const { error } = await supabase.from('app_state').upsert({
      user_id: user.id,
      shopping_dates: dates,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    if (error) console.warn('shopping_dates sync failed', error);
  }, 250);
}

function setShoppingDate(id, value, showMessage = true) {
  const dates = readDates();
  if (value) dates[id] = value;
  else delete dates[id];
  writeDates(dates);
  syncDatesToCloud();
  enhanceShopping();
  if (showMessage) toast(value ? '采购日期已更新' : '已移回未安排日期');
}

function decorateItem(item, category, dates) {
  const checkbox = $('[data-check]', item);
  const id = checkbox?.dataset.check;
  if (!id) return null;
  item.dataset.shoppingId = id;
  item.dataset.category = item.dataset.category || category || '其他';

  if (!$('.shopping-category-chip', item)) {
    const chip = document.createElement('span');
    chip.className = 'shopping-category-chip';
    chip.textContent = `${categoryEmoji(item.dataset.category)} ${item.dataset.category}`;
    const qty = $('.qty', item);
    qty?.insertAdjacentElement('afterend', chip);
  }

  let control = $('.shopping-date-control', item);
  if (!control) {
    control = document.createElement('label');
    control.className = 'shopping-date-control';
    control.innerHTML = '<span>采购日期</span><input type="date" aria-label="采购日期（可选）"><button class="shopping-date-clear" type="button" aria-label="清除采购日期" title="清除日期">×</button>';
    const deleteButton = $('[data-del-manual]', item);
    if (deleteButton) item.insertBefore(control, deleteButton);
    else item.appendChild(control);

    const input = $('input', control);
    const clear = $('.shopping-date-clear', control);
    input.addEventListener('change', () => setShoppingDate(id, input.value));
    clear.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      input.value = '';
      setShoppingDate(id, '');
    });
  }

  const input = $('input', control);
  if (input) input.value = dates[id] || '';
  return { id, node: item, date: dates[id] || '' };
}

function ensureDateNote() {
  const toolbar = $('.shopping-toolbar');
  if (!toolbar || $('#shoppingDateNote')) return;
  const note = document.createElement('div');
  note.id = 'shoppingDateNote';
  note.className = 'shopping-date-note';
  note.innerHTML = '<span>📅</span><span><b>采购日期是可选的。</b> 知道哪天去买就填日期，不确定就留空；清单会自动按日期整理。</span>';
  toolbar.insertAdjacentElement('afterend', note);
}

function ensureQuickDateField() {
  const form = $('#quickAddForm');
  if (!form || $('#quickAddDate')) return;
  const button = $('button[type="submit"]', form);
  const label = document.createElement('label');
  label.className = 'quick-date-field';
  label.innerHTML = '<span>采购日期（可选）</span><input id="quickAddDate" type="date" aria-label="采购日期（可选）">';
  form.insertBefore(label, button);

  form.addEventListener('submit', () => {
    const chosenDate = $('#quickAddDate')?.value || '';
    const beforeIds = new Set((readMainState().manualShopping || []).map(item => item.id));
    const tryAttach = (attempt = 0) => {
      const manual = readMainState().manualShopping || [];
      const created = [...manual].reverse().find(item => !beforeIds.has(item.id));
      if (created) {
        if (chosenDate) setShoppingDate(created.id, chosenDate, false);
        setTimeout(enhanceShopping, 20);
        return;
      }
      if (attempt < 5) setTimeout(() => tryAttach(attempt + 1), 60);
    };
    setTimeout(() => tryAttach(), 20);
  }, true);
}

function enhanceShopping() {
  if (enhancing) return;
  const root = $('#shoppingGroups');
  if (!root) return;
  const rawSections = $$('.shopping-group', root);
  const existingItems = $$('.shopping-item', root);
  if (!rawSections.length && !existingItems.length) return;

  enhancing = true;
  try {
    const dates = readDates();
    const entries = [];
    if (rawSections.length) {
      rawSections.forEach(section => {
        const category = categoryFromSection(section);
        $$('.shopping-item', section).forEach(item => {
          const entry = decorateItem(item, category, dates);
          if (entry) entries.push(entry);
        });
      });
    } else {
      existingItems.forEach(item => {
        const entry = decorateItem(item, item.dataset.category || '其他', dates);
        if (entry) entries.push(entry);
      });
    }
    if (!entries.length) return;

    const grouped = new Map();
    entries.forEach(entry => {
      if (!grouped.has(entry.date)) grouped.set(entry.date, []);
      grouped.get(entry.date).push(entry.node);
    });
    const keys = [...grouped.keys()].sort((a,b) => {
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b);
    });

    root.replaceChildren();
    keys.forEach(key => {
      const meta = dateLabel(key);
      const section = document.createElement('section');
      section.className = `card shopping-date-group${key ? '' : ' unscheduled'}`;
      const head = document.createElement('div');
      head.className = 'shopping-date-head';
      head.innerHTML = `<div class="shopping-date-title"><span>📅</span><div><h3>${meta.title}</h3><span>${meta.subtitle}</span></div></div><span class="shopping-date-count">${grouped.get(key).length} 项</span>`;
      const itemsWrap = document.createElement('div');
      itemsWrap.className = 'shopping-date-items';
      grouped.get(key).forEach(node => itemsWrap.appendChild(node));
      section.append(head, itemsWrap);
      root.appendChild(section);
    });
  } finally {
    enhancing = false;
  }
}

async function pullCloudDates() {
  if (!supabase) return;
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return;
  const { data, error } = await supabase.from('app_state').select('shopping_dates').eq('user_id', user.id).maybeSingle();
  if (error) return;
  const merged = { ...readDates(), ...(data?.shopping_dates || {}) };
  writeDates(merged);
  enhanceShopping();
}

function init() {
  injectStyles();
  const badge = $('.brand small');
  if (badge) badge.textContent = 'v1.0.006';
  ensureQuickDateField();
  ensureDateNote();
  enhanceShopping();

  const root = $('#shoppingGroups');
  if (root) {
    new MutationObserver(() => {
      if (!enhancing) setTimeout(enhanceShopping, 0);
    }).observe(root, { childList: true, subtree: true });
  }

  window.addEventListener('hashchange', () => {
    if (location.hash === '#shopping') setTimeout(() => {
      ensureQuickDateField();
      ensureDateNote();
      enhanceShopping();
    }, 0);
  });
  window.addEventListener('focus', () => {
    if (location.hash === '#shopping') enhanceShopping();
  });

  if (supabase) {
    supabase.auth.onAuthStateChange(() => setTimeout(pullCloudDates, 250));
    setTimeout(pullCloudDates, 700);
  }
}

init();
