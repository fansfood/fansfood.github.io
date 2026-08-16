import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const cfg = window.SHIGUANG_CONFIG || {};
const supabase = cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY
  ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY)
  : null;

let currentUser = null;
let profile = null;
let groups = [];
let activeGroup = null;
let membership = null;
let groupMembers = [];
let siteDishes = [];
let tomorrowVotes = [];
let myVote = null;

function showToast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._tomorrowTimer);
  el._tomorrowTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
function esc(value = '') {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[ch]);
}
function tomorrowISO() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function tomorrowLabel() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  const weekdays = ['周日','周一','周二','周三','周四','周五','周六'];
  return `${d.getMonth()+1}月${d.getDate()}日 · ${weekdays[d.getDay()]}`;
}
function publicDishImage(dish) {
  if (dish.image_url) return dish.image_url;
  if (dish.image_path && supabase) return supabase.storage.from('dish-images').getPublicUrl(dish.image_path).data.publicUrl;
  return 'assets/images/recipe-placeholder.svg';
}
function selectedGroupId() { return localStorage.getItem('fansfood-active-group') || ''; }
function setSelectedGroup(id) {
  if (id) localStorage.setItem('fansfood-active-group', id); else localStorage.removeItem('fansfood-active-group');
  window.dispatchEvent(new CustomEvent('fansfood-group-changed', { detail: { groupId: id || null } }));
}
function roleLabel(role) { return role === 'chef' ? '大厨' : role === 'foodie' ? '美食家' : '未选择身份'; }
function isChef() { return membership?.member_role === 'chef' || (activeGroup?.owner_id === currentUser?.id && profile?.food_role === 'chef'); }
function isFoodie() { return membership?.member_role === 'foodie'; }

async function syncSession() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  currentUser = data.session?.user || null;
}
async function loadProfile() {
  profile = null;
  if (!currentUser) return;
  const { data } = await supabase.from('user_accounts').select('user_id,username,food_role').eq('user_id', currentUser.id).maybeSingle();
  profile = data || null;
}
async function loadGroups() {
  groups = []; activeGroup = null; membership = null;
  if (!currentUser) return;
  const { data, error } = await supabase.from('food_groups').select('id,name,description,invite_code,owner_id,created_at').order('created_at', { ascending: false });
  if (error) { console.warn(error); return; }
  groups = data || [];
  const wanted = selectedGroupId();
  activeGroup = groups.find(g => g.id === wanted) || groups[0] || null;
  if (activeGroup && activeGroup.id !== wanted) localStorage.setItem('fansfood-active-group', activeGroup.id);
}
async function loadMembership() {
  membership = null; groupMembers = [];
  if (!activeGroup || !currentUser) return;
  const { data, error } = await supabase.from('group_members').select('group_id,user_id,member_name,member_role,joined_at').eq('group_id', activeGroup.id).order('joined_at');
  if (!error) {
    groupMembers = data || [];
    membership = groupMembers.find(m => m.user_id === currentUser.id) || null;
  }
}
async function loadDishes() {
  siteDishes = [];
  if (!activeGroup || !supabase) { renderDishes(); return; }
  const { data, error } = await supabase
    .from('site_dishes')
    .select('id,name,description,category,image_path,image_url,is_active,created_at,group_id')
    .eq('group_id', activeGroup.id)
    .order('created_at', { ascending: true });
  if (error) { console.warn(error); showToast('群组菜品加载失败'); return; }
  siteDishes = (data || []).map(d => ({ ...d, image: publicDishImage(d) }));
  renderDishes();
  if (isChef()) renderDishManager();
}
async function loadVotes() {
  tomorrowVotes = []; myVote = null;
  if (!activeGroup || !currentUser) { renderVoteSummary(); return; }
  if (isFoodie()) {
    const { data } = await supabase.from('tomorrow_votes')
      .select('id,dish_id,voter_user_id,target_date,created_at')
      .eq('group_id', activeGroup.id)
      .eq('target_date', tomorrowISO())
      .eq('voter_user_id', currentUser.id)
      .maybeSingle();
    myVote = data || null;
  }
  if (isChef()) {
    const { data, error } = await supabase.from('tomorrow_votes')
      .select('id,dish_id,voter_user_id,target_date,created_at')
      .eq('group_id', activeGroup.id)
      .eq('target_date', tomorrowISO());
    if (error) { console.warn(error); showToast('投票汇总读取失败'); return; }
    tomorrowVotes = data || [];
  }
  renderDishes();
  renderVoteSummary();
}

function renderGroupContext() {
  const box = $('#tomorrowGroupContext');
  if (!box) return;
  if (!currentUser) {
    box.innerHTML = `<div class="group-context-message"><span>👤</span><div><b>先登录再进入群组投票</b><small>群组投票只对群成员开放。</small></div><button class="btn primary" id="tomorrowLoginBtn">登录 / 注册</button></div>`;
    $('#tomorrowLoginBtn').onclick = () => $('#accountBtn')?.click();
    return;
  }
  if (!profile?.food_role) {
    box.innerHTML = `<div class="group-context-message"><span>🎭</span><div><b>还没有选择身份</b><small>请先在账户里选择“大厨”或“美食家”。</small></div><button class="btn primary" id="tomorrowRoleBtn">去设置</button></div>`;
    $('#tomorrowRoleBtn').onclick = () => $('#accountBtn')?.click();
    return;
  }
  if (!groups.length) {
    box.innerHTML = `<div class="group-context-message"><span>👥</span><div><b>还没有加入群组</b><small>${profile.food_role === 'chef' ? '创建一个小饭桌，或者用邀请码加入。' : '向大厨索取邀请码后加入。'}</small></div><a class="btn primary" href="#groups">去我的群组</a></div>`;
    return;
  }
  box.innerHTML = `<div class="group-context-select"><div><span class="eyebrow">CURRENT GROUP</span><b>${esc(activeGroup?.name || '')}</b><small>${roleLabel(membership?.member_role || profile.food_role)}</small></div><select id="tomorrowGroupSelect">${groups.map(g => `<option value="${g.id}" ${g.id === activeGroup?.id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select><a class="btn ghost" href="#groups">群组管理</a></div>`;
  $('#tomorrowGroupSelect').onchange = async e => {
    setSelectedGroup(e.target.value);
    await refreshTomorrow();
  };
}

function renderDishes() {
  const grid = $('#tomorrowDishGrid');
  if (!grid) return;
  const date = $('#tomorrowDateLabel'); if (date) date.textContent = tomorrowLabel();
  const status = $('#voteStatus');
  if (!currentUser || !activeGroup) {
    grid.innerHTML = '<div class="card empty">加入群组后，这里会显示该群组的“明天吃什么”菜品。</div>';
    if (status) status.innerHTML = '';
    return;
  }
  const active = siteDishes.filter(d => d.is_active !== false);
  if (status) {
    if (isChef()) status.innerHTML = '<span class="voted-pill chef-pill">👨‍🍳 大厨视图</span>';
    else if (myVote) status.innerHTML = '<span class="voted-pill">✓ 已提交明日选择</span>';
    else status.innerHTML = '<span class="meal-meta">🍽️ 美食家 · 每个群组每天一票</span>';
  }
  grid.innerHTML = active.length ? active.map(d => {
    const chosen = myVote?.dish_id === d.id;
    return `<article class="card vote-card ${chosen ? 'voted' : ''}">
      <div class="vote-card-photo"><img src="${esc(d.image)}" alt="${esc(d.name)}"><span class="tag vote-category">${esc(d.category || '其他')}</span></div>
      <div class="vote-card-body"><h3>${esc(d.name)}</h3><p>${esc(d.description || '今天就想吃这一口。')}</p>
      ${isChef()
        ? '<button class="btn ghost vote-btn" disabled>大厨查看食客投票</button>'
        : `<button class="btn ${chosen ? 'ghost' : 'primary'} vote-btn" data-vote-dish="${d.id}" ${myVote ? 'disabled' : ''}>${chosen ? '✓ 我选了这个' : myVote ? '今天已经选过' : '我想吃这个'}</button>`}
      </div></article>`;
  }).join('') : '<div class="card empty">这个群组还没有可投票的菜品，大厨可以在下方添加。</div>';
  $$('[data-vote-dish]').forEach(btn => btn.onclick = () => submitVote(btn.dataset.voteDish));
}

async function submitVote(dishId) {
  if (!supabase || !currentUser || !activeGroup || !isFoodie()) { showToast('只有群组里的美食家可以投票'); return; }
  if (myVote) { showToast('你在这个群组今天已经投过票啦'); return; }
  const { error } = await supabase.from('tomorrow_votes').insert({
    target_date: tomorrowISO(), dish_id: dishId, voter_token: crypto.randomUUID(), group_id: activeGroup.id, voter_user_id: currentUser.id,
  });
  if (error) { showToast(error.code === '23505' ? '你在这个群组今天已经投过票啦' : (error.message || '提交失败')); return; }
  showToast('收到！大厨已经能看到你的选择 🍽️');
  await loadVotes();
}

function renderAdminPanel() {
  const panel = $('#adminVotePanel');
  if (!panel) return;
  panel.hidden = !activeGroup || !isChef();
}
function renderVoteSummary() {
  renderAdminPanel();
  const list = $('#voteSummaryList');
  if (!list || !activeGroup || !isChef()) return;
  const memberMap = new Map(groupMembers.map(m => [m.user_id, m]));
  const byDish = new Map();
  tomorrowVotes.forEach(v => {
    if (!byDish.has(v.dish_id)) byDish.set(v.dish_id, []);
    byDish.get(v.dish_id).push(v);
  });
  const ranked = siteDishes.map(d => ({ ...d, voters: byDish.get(d.id) || [] })).sort((a,b) => b.voters.length - a.voters.length || a.name.localeCompare(b.name));
  const withVotes = ranked.filter(d => d.voters.length > 0);
  const uniqueVoters = new Set(tomorrowVotes.map(v => v.voter_user_id).filter(Boolean)).size;
  const max = Math.max(1, ...ranked.map(d => d.voters.length));
  $('#voteParticipantCount').textContent = uniqueVoters;
  $('#voteDishCount').textContent = withVotes.length;
  $('#voteTopDish').textContent = withVotes[0]?.name || '—';
  list.innerHTML = ranked.length ? ranked.map((d,index) => {
    const names = d.voters.map(v => memberMap.get(v.voter_user_id)?.member_name || '美食家').join('、');
    return `<div class="vote-summary-row group-vote-row"><div class="vote-rank">${index+1}</div><img src="${esc(d.image)}" alt="${esc(d.name)}"><div class="vote-summary-main"><div class="vote-summary-title"><b>${esc(d.name)}</b><span>${d.voters.length} 票</span></div><div class="vote-bar-track"><div class="vote-bar-fill" style="width:${d.voters.length/max*100}%"></div></div>${names ? `<div class="vote-voter-names">${esc(names)}</div>` : '<div class="vote-voter-names muted">暂时没人选择</div>'}</div></div>`;
  }).join('') : '<div class="empty">暂无菜品。</div>';
}

function renderDishManager() {
  const list = $('#dishManagerList'); if (!list || !activeGroup) return;
  $('#dishManagerCount').textContent = `${siteDishes.length} 道 · ${activeGroup.name}`;
  list.innerHTML = siteDishes.length ? siteDishes.map(d => `<div class="dish-manager-item ${d.is_active ? '' : 'inactive'}"><img src="${esc(d.image)}" alt="${esc(d.name)}"><div><b>${esc(d.name)}</b><span>${esc(d.category || '其他')} · ${d.is_active ? '投票页可见' : '已暂停'}</span></div><button class="btn ghost" data-toggle-dish="${d.id}" data-active="${d.is_active}">${d.is_active ? '暂停' : '上架'}</button><button class="icon-btn delete-dish" data-delete-dish="${d.id}" title="删除">×</button></div>`).join('') : '<div class="empty">还没有菜品。</div>';
  $$('[data-toggle-dish]').forEach(btn => btn.onclick = () => toggleDish(btn.dataset.toggleDish, btn.dataset.active !== 'true'));
  $$('[data-delete-dish]').forEach(btn => btn.onclick = () => deleteDish(btn.dataset.deleteDish));
}
async function createDish(event) {
  event.preventDefault();
  if (!isChef() || !currentUser || !activeGroup || !supabase) { showToast('只有本群大厨可以添加菜品'); return; }
  const button = $('#saveDishBtn'); const file = $('#dishImage').files[0];
  if (!file) { showToast('请选择菜品照片'); return; }
  button.disabled = true; button.textContent = '正在上传…';
  let imagePath = null;
  try {
    const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase();
    imagePath = `${currentUser.id}/${activeGroup.id}-${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('dish-images').upload(imagePath, file, { cacheControl:'86400', upsert:false, contentType:file.type || undefined });
    if (uploadError) throw uploadError;
    const imageUrl = supabase.storage.from('dish-images').getPublicUrl(imagePath).data.publicUrl;
    const { error } = await supabase.from('site_dishes').insert({ name:$('#dishName').value.trim(), description:$('#dishDescription').value.trim(), category:$('#dishCategory').value, image_path:imagePath, image_url:imageUrl, created_by:currentUser.id, is_active:true, group_id:activeGroup.id });
    if (error) throw error;
    event.target.reset(); await loadDishes(); await loadVotes(); showToast('新菜品已经加入这个群组 ✨');
  } catch (error) {
    if (imagePath) await supabase.storage.from('dish-images').remove([imagePath]).catch(() => undefined);
    console.error(error); showToast(error.message || '菜品上传失败');
  } finally { button.disabled = false; button.textContent = '上传并加入菜品'; }
}
async function toggleDish(id, nextActive) {
  if (!isChef() || !activeGroup) return;
  const { error } = await supabase.from('site_dishes').update({ is_active:nextActive, updated_at:new Date().toISOString() }).eq('id', id).eq('group_id', activeGroup.id);
  if (error) { showToast('状态修改失败'); return; }
  await loadDishes(); showToast(nextActive ? '菜品已重新上架' : '菜品已暂停');
}
async function deleteDish(id) {
  if (!isChef() || !activeGroup) return;
  const dish = siteDishes.find(d => d.id === id); if (!dish) return;
  if (!confirm(`确定从“${activeGroup.name}”删除“${dish.name}”吗？相关投票也会一并删除。`)) return;
  const { error } = await supabase.from('site_dishes').delete().eq('id', id).eq('group_id', activeGroup.id);
  if (error) { showToast('删除失败'); return; }
  if (dish.image_path) await supabase.storage.from('dish-images').remove([dish.image_path]).catch(() => undefined);
  await loadDishes(); await loadVotes(); showToast('菜品已删除');
}

async function refreshTomorrow() {
  if (!supabase) return;
  await syncSession(); await loadProfile(); await loadGroups(); await loadMembership();
  renderGroupContext();
  await loadDishes(); await loadVotes(); renderAdminPanel();
}

const dishForm = $('#dishForm'); if (dishForm) dishForm.addEventListener('submit', createDish);
const manageButton = $('#manageDishesBtn'); if (manageButton) manageButton.onclick = async () => {
  await refreshTomorrow();
  if (!isChef()) { showToast('只有当前群组的大厨可以管理菜品'); return; }
  $('#dishManagerDialog').showModal(); renderDishManager();
};
const refreshButton = $('#refreshVotesBtn'); if (refreshButton) refreshButton.onclick = async () => { await refreshTomorrow(); showToast('群组投票汇总已刷新'); };
const closeButton = $('#dishManagerClose'); if (closeButton) closeButton.onclick = () => $('#dishManagerDialog').close();

window.addEventListener('hashchange', () => { if (location.hash === '#tomorrow') refreshTomorrow(); });
window.addEventListener('focus', () => { if (location.hash === '#tomorrow') refreshTomorrow(); });
window.addEventListener('fansfood-group-changed', () => { if (location.hash === '#tomorrow') refreshTomorrow(); });
window.addEventListener('fansfood-account-changed', refreshTomorrow);
if (supabase) {
  supabase.auth.onAuthStateChange(() => setTimeout(refreshTomorrow, 0));
  refreshTomorrow();
} else {
  renderGroupContext(); renderDishes();
}
