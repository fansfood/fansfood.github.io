import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const cfg = window.SHIGUANG_CONFIG || {};
const supabase = cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY
  ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY)
  : null;

let currentUser = null;
let isAdmin = false;
let siteDishes = [];
let tomorrowVotes = [];

function showToast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._tomorrowTimer);
  el._tomorrowTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function tomorrowLabel() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const weekdays = ['周日','周一','周二','周三','周四','周五','周六'];
  return `${d.getMonth() + 1}月${d.getDate()}日 · ${weekdays[d.getDay()]}`;
}

function voterToken() {
  let token = localStorage.getItem('fansfood-voter-token');
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem('fansfood-voter-token', token);
  }
  return token;
}

function voteStorageKey() {
  return `fansfood-vote-${tomorrowISO()}`;
}

function votedDishId() {
  return localStorage.getItem(voteStorageKey()) || '';
}

function publicDishImage(dish) {
  if (dish.image_url) return dish.image_url;
  if (dish.image_path && supabase) {
    return supabase.storage.from('dish-images').getPublicUrl(dish.image_path).data.publicUrl;
  }
  return 'assets/images/recipe-placeholder.svg';
}

async function syncSession() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  currentUser = data.session?.user || null;
  await checkAdmin();
}

async function checkAdmin() {
  isAdmin = false;
  if (!currentUser || !supabase) {
    renderAdminPanel();
    return;
  }
  const { data, error } = await supabase
    .from('site_admins')
    .select('user_id')
    .eq('user_id', currentUser.id)
    .maybeSingle();
  isAdmin = !error && !!data;
  renderAdminPanel();
}

async function loadDishes() {
  if (!supabase) {
    siteDishes = [];
    renderDishes();
    return;
  }
  const { data, error } = await supabase
    .from('site_dishes')
    .select('id,name,description,category,image_path,image_url,is_active,created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.warn(error);
    showToast('菜品加载失败，请稍后刷新');
    return;
  }

  siteDishes = (data || []).map(d => ({ ...d, image: publicDishImage(d) }));
  renderDishes();
  if (isAdmin) renderDishManager();
}

async function loadVotes() {
  tomorrowVotes = [];
  if (!isAdmin || !supabase) {
    renderVoteSummary();
    return;
  }
  const { data, error } = await supabase
    .from('tomorrow_votes')
    .select('dish_id,target_date,created_at')
    .eq('target_date', tomorrowISO());

  if (error) {
    console.warn(error);
    showToast('投票汇总读取失败');
    return;
  }
  tomorrowVotes = data || [];
  renderVoteSummary();
}

function renderDishes() {
  const grid = $('#tomorrowDishGrid');
  if (!grid) return;

  const date = $('#tomorrowDateLabel');
  if (date) date.textContent = tomorrowLabel();

  const chosen = votedDishId();
  const active = siteDishes.filter(d => d.is_active !== false);
  const status = $('#voteStatus');
  if (status) {
    status.innerHTML = chosen
      ? '<span class="voted-pill">✓ 已提交今天的选择</span>'
      : '<span class="meal-meta">匿名选择 · 每台设备一次</span>';
  }

  grid.innerHTML = active.length
    ? active.map(d => `
      <article class="card vote-card ${chosen === d.id ? 'voted' : ''}">
        <div class="vote-card-photo">
          <img src="${d.image}" alt="${escapeHtml(d.name)}">
          <span class="tag vote-category">${escapeHtml(d.category || '其他')}</span>
        </div>
        <div class="vote-card-body">
          <h3>${escapeHtml(d.name)}</h3>
          <p>${escapeHtml(d.description || '今天就想吃这一口。')}</p>
          <button class="btn ${chosen === d.id ? 'ghost' : 'primary'} vote-btn"
                  data-vote-dish="${d.id}" ${chosen ? 'disabled' : ''}>
            ${chosen === d.id ? '✓ 我选了这个' : chosen ? '今天已经选过' : '我想吃这个'}
          </button>
        </div>
      </article>`).join('')
    : '<div class="card empty">主人还没有发布可选菜品。</div>';

  $$('[data-vote-dish]').forEach(btn => {
    btn.onclick = () => submitVote(btn.dataset.voteDish);
  });
}

async function submitVote(dishId) {
  if (!supabase) {
    showToast('云端暂时不可用');
    return;
  }
  if (votedDishId()) {
    showToast('你今天已经提交过选择啦');
    return;
  }

  const { error } = await supabase.from('tomorrow_votes').insert({
    target_date: tomorrowISO(),
    dish_id: dishId,
    voter_token: voterToken()
  });

  if (error) {
    if (error.code === '23505') showToast('这台设备今天已经投过票啦');
    else showToast(error.message || '提交失败，请稍后再试');
    return;
  }

  localStorage.setItem(voteStorageKey(), dishId);
  renderDishes();
  showToast('收到！明天想吃的已经告诉主人 🍽');
  if (isAdmin) await loadVotes();
}

function countsByDish() {
  const counts = new Map();
  tomorrowVotes.forEach(v => counts.set(v.dish_id, (counts.get(v.dish_id) || 0) + 1));
  return counts;
}

function renderAdminPanel() {
  const panel = $('#adminVotePanel');
  if (!panel) return;
  panel.hidden = !isAdmin;
  if (isAdmin) renderVoteSummary();
}

function renderVoteSummary() {
  const list = $('#voteSummaryList');
  if (!list || !isAdmin) return;

  const counts = countsByDish();
  const ranked = siteDishes
    .map(d => ({ ...d, count: counts.get(d.id) || 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const total = tomorrowVotes.length;
  const withVotes = ranked.filter(d => d.count > 0);
  const max = Math.max(1, ...ranked.map(d => d.count));

  $('#voteParticipantCount').textContent = total;
  $('#voteDishCount').textContent = withVotes.length;
  $('#voteTopDish').textContent = withVotes[0]?.name || '—';

  list.innerHTML = ranked.length
    ? ranked.map((d, index) => `
      <div class="vote-summary-row">
        <div class="vote-rank">${index + 1}</div>
        <img src="${d.image}" alt="${escapeHtml(d.name)}">
        <div class="vote-summary-main">
          <div class="vote-summary-title">
            <b>${escapeHtml(d.name)}</b><span>${d.count} 票</span>
          </div>
          <div class="vote-bar-track">
            <div class="vote-bar-fill" style="width:${d.count / max * 100}%"></div>
          </div>
        </div>
      </div>`).join('')
    : '<div class="empty">暂无菜品。</div>';
}

function renderDishManager() {
  const list = $('#dishManagerList');
  if (!list) return;
  $('#dishManagerCount').textContent = `${siteDishes.length} 道`;

  list.innerHTML = siteDishes.length
    ? siteDishes.map(d => `
      <div class="dish-manager-item ${d.is_active ? '' : 'inactive'}">
        <img src="${d.image}" alt="${escapeHtml(d.name)}">
        <div><b>${escapeHtml(d.name)}</b><span>${escapeHtml(d.category || '其他')} · ${d.is_active ? '投票页可见' : '已暂停'}</span></div>
        <button class="btn ghost" data-toggle-dish="${d.id}" data-active="${d.is_active}">${d.is_active ? '暂停' : '上架'}</button>
        <button class="icon-btn delete-dish" data-delete-dish="${d.id}" title="删除">×</button>
      </div>`).join('')
    : '<div class="empty">还没有菜品。</div>';

  $$('[data-toggle-dish]').forEach(btn => {
    btn.onclick = () => toggleDish(btn.dataset.toggleDish, btn.dataset.active !== 'true');
  });
  $$('[data-delete-dish]').forEach(btn => {
    btn.onclick = () => deleteDish(btn.dataset.deleteDish);
  });
}

async function createDish(event) {
  event.preventDefault();
  await syncSession();
  if (!isAdmin || !currentUser || !supabase) {
    showToast('只有管理员可以添加菜品');
    return;
  }

  const button = $('#saveDishBtn');
  const file = $('#dishImage').files[0];
  if (!file) {
    showToast('请选择菜品照片');
    return;
  }

  button.disabled = true;
  button.textContent = '正在上传…';

  try {
    const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const imagePath = `${currentUser.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('dish-images')
      .upload(imagePath, file, {
        cacheControl: '86400',
        upsert: false,
        contentType: file.type || undefined
      });

    if (uploadError) throw uploadError;

    const imageUrl = supabase.storage.from('dish-images').getPublicUrl(imagePath).data.publicUrl;
    const { error } = await supabase.from('site_dishes').insert({
      name: $('#dishName').value.trim(),
      description: $('#dishDescription').value.trim(),
      category: $('#dishCategory').value,
      image_path: imagePath,
      image_url: imageUrl,
      created_by: currentUser.id,
      is_active: true
    });

    if (error) {
      await supabase.storage.from('dish-images').remove([imagePath]);
      throw error;
    }

    event.target.reset();
    await loadDishes();
    await loadVotes();
    showToast('新菜品已经发布到投票页 ✨');
  } catch (error) {
    console.error(error);
    showToast(error.message || '菜品上传失败');
  } finally {
    button.disabled = false;
    button.textContent = '上传并加入菜品';
  }
}

async function toggleDish(id, nextActive) {
  await syncSession();
  if (!isAdmin || !supabase) return;

  const { error } = await supabase
    .from('site_dishes')
    .update({ is_active: nextActive, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    showToast('状态修改失败');
    return;
  }

  await loadDishes();
  showToast(nextActive ? '菜品已重新上架' : '菜品已暂停');
}

async function deleteDish(id) {
  await syncSession();
  if (!isAdmin || !supabase) return;

  const dish = siteDishes.find(d => d.id === id);
  if (!dish) return;
  if (!confirm(`确定删除“${dish.name}”吗？相关投票也会一并删除。`)) return;

  const { error } = await supabase.from('site_dishes').delete().eq('id', id);
  if (error) {
    showToast('删除失败');
    return;
  }

  if (dish.image_path) {
    await supabase.storage.from('dish-images').remove([dish.image_path]);
  }

  await loadDishes();
  await loadVotes();
  showToast('菜品已删除');
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[ch]);
}

async function refreshTomorrow() {
  if (!supabase) return;
  await syncSession();
  await loadDishes();
  if (isAdmin) await loadVotes();
  renderAdminPanel();
}

const dishForm = $('#dishForm');
if (dishForm) dishForm.addEventListener('submit', createDish);

const manageButton = $('#manageDishesBtn');
if (manageButton) manageButton.onclick = async () => {
  await refreshTomorrow();
  if (!isAdmin) {
    showToast('请先用管理员账号登录');
    return;
  }
  $('#dishManagerDialog').showModal();
  renderDishManager();
};

const refreshButton = $('#refreshVotesBtn');
if (refreshButton) refreshButton.onclick = async () => {
  await refreshTomorrow();
  showToast('汇总已刷新');
};

const closeButton = $('#dishManagerClose');
if (closeButton) closeButton.onclick = () => $('#dishManagerDialog').close();

window.addEventListener('hashchange', () => {
  if (location.hash === '#tomorrow') refreshTomorrow();
});
window.addEventListener('focus', () => {
  if (location.hash === '#tomorrow') refreshTomorrow();
});

if (supabase) {
  supabase.auth.onAuthStateChange(() => {
    setTimeout(refreshTomorrow, 0);
  });
  refreshTomorrow();
} else {
  renderDishes();
}
