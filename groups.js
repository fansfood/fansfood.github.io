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
let members = [];
let groupRecipes = [];
let shopping = [];

function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._groupTimer);
  el._groupTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
function esc(value = '') {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[ch]);
}
function roleLabel(role) { return role === 'chef' ? '大厨' : role === 'foodie' ? '美食家' : '未选择'; }
function roleEmoji(role) { return role === 'chef' ? '👨‍🍳' : role === 'foodie' ? '🍽️' : '👤'; }
function activeGroupId() { return localStorage.getItem('fansfood-active-group') || ''; }
function setActiveGroupId(id, notify = true) {
  if (id) localStorage.setItem('fansfood-active-group', id);
  else localStorage.removeItem('fansfood-active-group');
  if (notify) window.dispatchEvent(new CustomEvent('fansfood-group-changed', { detail: { groupId: id || null } }));
}
function publicImage(path, url) {
  if (url) return url;
  if (path && supabase) return supabase.storage.from('dish-images').getPublicUrl(path).data.publicUrl;
  return 'assets/images/recipe-placeholder.svg';
}

async function syncSession() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  currentUser = data.session?.user || null;
}
async function loadProfile() {
  profile = null;
  if (!currentUser || !supabase) return;
  const { data } = await supabase
    .from('user_accounts')
    .select('user_id,username,food_role,bound_email,email_verified')
    .eq('user_id', currentUser.id)
    .maybeSingle();
  profile = data || null;
}
async function loadGroups() {
  groups = [];
  activeGroup = null;
  if (!currentUser || !supabase) return;
  const { data, error } = await supabase
    .from('food_groups')
    .select('id,name,description,invite_code,owner_id,created_at')
    .order('created_at', { ascending: false });
  if (error) {
    console.warn(error);
    toast('群组加载失败');
    return;
  }
  groups = data || [];
  const wanted = activeGroupId();
  activeGroup = groups.find(g => g.id === wanted) || groups[0] || null;
  if (activeGroup && activeGroup.id !== wanted) setActiveGroupId(activeGroup.id, false);
  if (!activeGroup) setActiveGroupId('', false);
}
async function loadGroupData() {
  members = [];
  groupRecipes = [];
  shopping = [];
  if (!activeGroup || !currentUser || !supabase) return;
  const [m, r, s] = await Promise.all([
    supabase.from('group_members').select('group_id,user_id,member_name,member_role,joined_at').eq('group_id', activeGroup.id).order('joined_at'),
    supabase.from('group_recipes').select('*').eq('group_id', activeGroup.id).order('created_at', { ascending: false }),
    supabase.from('group_shopping_items').select('*').eq('group_id', activeGroup.id).order('is_checked').order('created_at', { ascending: false }),
  ]);
  if (!m.error) members = m.data || [];
  if (!r.error) groupRecipes = r.data || [];
  if (!s.error) shopping = s.data || [];
}
function myMembership() { return members.find(m => m.user_id === currentUser?.id) || null; }
function canChef() { return myMembership()?.member_role === 'chef' || profile?.food_role === 'chef' && activeGroup?.owner_id === currentUser?.id; }
function isOwner() { return activeGroup?.owner_id === currentUser?.id; }

async function refreshGroups() {
  await syncSession();
  await loadProfile();
  await loadGroups();
  await loadGroupData();
  renderGroupsPage();
}

function renderGroupsPage() {
  const root = $('#groupsPageContent');
  if (!root) return;
  if (!supabase) {
    root.innerHTML = '<div class="card empty">云端暂不可用。</div>';
    return;
  }
  if (!currentUser) {
    root.innerHTML = `
      <div class="card group-empty-state">
        <div class="group-empty-icon">👥</div>
        <h2>登录后加入你的小饭桌</h2>
        <p>群组里的投票、菜谱和采购互相独立。登录后可以用邀请码加入。</p>
        <button class="btn primary" id="groupLoginBtn">登录 / 注册</button>
      </div>`;
    $('#groupLoginBtn').onclick = () => $('#accountBtn')?.click();
    return;
  }
  if (!profile?.food_role) {
    root.innerHTML = `
      <div class="card identity-gate">
        <span class="eyebrow">CHOOSE YOUR ROLE</span>
        <h2>先选一个你的食光身份</h2>
        <p>身份会决定你在所有群组里的权限，之后可以在账户设置里调整。</p>
        <div class="identity-choice-grid">
          <button class="identity-card" data-pick-role="chef"><span>👨‍🍳</span><b>我是大厨</b><small>创建群组、看投票、发菜谱、管采购</small></button>
          <button class="identity-card" data-pick-role="foodie"><span>🍽️</span><b>我是美食家</b><small>加入群组、浏览菜谱、参与明日投票</small></button>
        </div>
      </div>`;
    $$('[data-pick-role]').forEach(btn => btn.onclick = () => chooseRole(btn.dataset.pickRole));
    return;
  }

  const chef = profile.food_role === 'chef';
  const groupCards = groups.length ? groups.map(g => `
    <button class="group-switch-card ${activeGroup?.id === g.id ? 'active' : ''}" data-group-id="${g.id}">
      <span class="group-card-icon">${g.owner_id === currentUser.id ? '🏠' : '👥'}</span>
      <span><b>${esc(g.name)}</b><small>${esc(g.description || '一起决定明天吃什么')}</small></span>
      ${g.owner_id === currentUser.id ? '<em>群主</em>' : ''}
    </button>`).join('') : '<div class="empty">还没有加入任何群组。</div>';

  root.innerHTML = `
    <div class="identity-banner card">
      <div><span class="identity-avatar">${roleEmoji(profile.food_role)}</span><div><span class="eyebrow">MY ROLE</span><h2>${roleLabel(profile.food_role)}</h2><p>@${esc(profile.username || '食光用户')}</p></div></div>
      <div class="identity-permissions">${chef ? '可以创建群组 · 查看食客投票 · 发布群组菜谱 · 管理群组采购' : '可以加入群组 · 浏览群组菜谱 · 参与“明天吃什么”投票'}</div>
    </div>

    <div class="group-layout">
      <aside class="card group-sidebar">
        <div class="group-sidebar-head"><div><span class="eyebrow">MY GROUPS</span><h3>我的群组</h3></div><span>${groups.length}</span></div>
        <div class="group-switch-list">${groupCards}</div>
        <div class="group-join-box">
          <h4>用邀请码加入</h4>
          <form id="joinGroupForm"><input id="joinGroupCode" maxlength="12" placeholder="输入邀请码" required><button class="btn ghost" type="submit">加入</button></form>
        </div>
        ${chef ? `<div class="group-create-box"><h4>创建新群组</h4><form id="createGroupForm"><input id="createGroupName" maxlength="60" placeholder="例如：白俄小饭桌" required><textarea id="createGroupDescription" maxlength="240" rows="2" placeholder="一句群组介绍（可选）"></textarea><button class="btn primary" type="submit">创建群组</button></form></div>` : ''}
      </aside>
      <section class="group-main" id="activeGroupPanel">${renderActiveGroupHtml()}</section>
    </div>`;

  $$('[data-group-id]').forEach(btn => btn.onclick = async () => {
    setActiveGroupId(btn.dataset.groupId);
    await refreshGroups();
  });
  $('#joinGroupForm').onsubmit = joinGroup;
  if (chef) $('#createGroupForm').onsubmit = createGroup;
  installActiveGroupHandlers();
}

function renderActiveGroupHtml() {
  if (!activeGroup) {
    return `<div class="card group-empty-state"><div class="group-empty-icon">🍲</div><h2>还没有小饭桌</h2><p>${profile?.food_role === 'chef' ? '创建一个群组，或使用邀请码加入别人的群组。' : '向大厨要一个邀请码，就可以加入群组开始投票。'}</p></div>`;
  }
  const chef = canChef();
  const chefs = members.filter(m => m.member_role === 'chef').length;
  const foodies = members.filter(m => m.member_role === 'foodie').length;
  const memberHtml = members.map(m => `<div class="member-row"><span>${m.member_role === 'chef' ? '👨‍🍳' : '🍽️'}</span><div><b>${esc(m.member_name)}</b><small>${roleLabel(m.member_role)}${m.user_id === activeGroup.owner_id ? ' · 群主' : ''}</small></div></div>`).join('');
  const recipeHtml = groupRecipes.length ? groupRecipes.map(r => `
    <article class="group-recipe-card">
      <img src="${esc(publicImage(r.image_path, r.image_url))}" alt="${esc(r.name)}">
      <div><span class="tag">${esc(r.category)}</span><h4>${esc(r.name)}</h4><p>${esc(r.description || '大厨刚刚发布了一道新菜谱。')}</p>${chef ? `<button class="text-danger" data-delete-group-recipe="${r.id}">删除</button>` : ''}</div>
    </article>`).join('') : '<div class="empty compact">群组里还没有发布菜谱。</div>';
  const shoppingHtml = shopping.length ? shopping.map(i => `
    <div class="group-shopping-row ${i.is_checked ? 'checked' : ''}">
      ${chef ? `<input type="checkbox" data-shop-toggle="${i.id}" ${i.is_checked ? 'checked' : ''}>` : `<span>${i.is_checked ? '✅' : '⬜'}</span>`}
      <div><b>${esc(i.name)}</b><small>${esc(i.quantity || '')}</small></div>
      ${chef ? `<button class="icon-btn" data-shop-delete="${i.id}">×</button>` : ''}
    </div>`).join('') : '<div class="empty compact">采购清单还是空的。</div>';

  return `
    <div class="card group-header-card">
      <div><span class="eyebrow">CURRENT GROUP</span><h2>${esc(activeGroup.name)}</h2><p>${esc(activeGroup.description || '一起决定明天吃什么。')}</p></div>
      <div class="group-header-actions">
        <a class="btn primary" href="#tomorrow">去投票页</a>
        ${!isOwner() ? '<button class="btn ghost" id="leaveGroupBtn">退出群组</button>' : '<button class="btn danger" id="deleteGroupBtn">删除群组</button>'}
      </div>
    </div>
    <div class="group-stats">
      <div class="card mini-stat"><b>${members.length}</b><span>群组成员</span></div>
      <div class="card mini-stat"><b>${chefs}</b><span>大厨</span></div>
      <div class="card mini-stat"><b>${foodies}</b><span>美食家</span></div>
      ${chef ? `<div class="card invite-stat"><span>邀请码</span><b>${esc(activeGroup.invite_code)}</b><button class="text-button" id="copyInviteBtn">复制</button></div>` : ''}
    </div>
    <div class="group-content-grid">
      <section class="card group-module">
        <div class="module-head"><div><span class="eyebrow">MEMBERS</span><h3>群成员</h3></div></div>
        <div class="member-list">${memberHtml || '<div class="empty compact">暂无成员。</div>'}</div>
      </section>
      <section class="card group-module group-module-wide">
        <div class="module-head"><div><span class="eyebrow">RECIPES</span><h3>群组菜谱</h3></div><span>${groupRecipes.length} 道</span></div>
        ${chef ? `<form class="group-inline-form recipe-publish-form" id="groupRecipeForm"><input id="groupRecipeName" maxlength="100" placeholder="菜谱名称" required><select id="groupRecipeCategory"><option>家常菜</option><option>主食</option><option>高蛋白</option><option>早餐</option><option>汤</option><option>甜品</option><option>其他</option></select><input id="groupRecipeImage" type="file" accept="image/*"><textarea id="groupRecipeDescription" rows="2" maxlength="500" placeholder="一句介绍"></textarea><textarea id="groupRecipeIngredients" rows="3" placeholder="食材，每行一项"></textarea><textarea id="groupRecipeSteps" rows="3" placeholder="步骤，每行一步"></textarea><button class="btn primary" type="submit">发布到群组</button></form>` : ''}
        <div class="group-recipe-list">${recipeHtml}</div>
      </section>
      <section class="card group-module group-module-wide">
        <div class="module-head"><div><span class="eyebrow">SHOPPING</span><h3>群组采购</h3></div><span>${shopping.filter(i => !i.is_checked).length} 项待买</span></div>
        ${chef ? `<form class="group-shopping-form" id="groupShoppingForm"><input id="groupShoppingName" maxlength="100" placeholder="食材 / 商品" required><input id="groupShoppingQty" maxlength="60" placeholder="数量，如 2 盒"><button class="btn primary" type="submit">加入采购</button></form>` : ''}
        <div class="group-shopping-list">${shoppingHtml}</div>
      </section>
    </div>`;
}

function installActiveGroupHandlers() {
  if (!activeGroup) return;
  if ($('#copyInviteBtn')) $('#copyInviteBtn').onclick = async () => {
    try { await navigator.clipboard.writeText(activeGroup.invite_code); toast('邀请码已复制'); }
    catch { toast(`邀请码：${activeGroup.invite_code}`); }
  };
  if ($('#leaveGroupBtn')) $('#leaveGroupBtn').onclick = leaveGroup;
  if ($('#deleteGroupBtn')) $('#deleteGroupBtn').onclick = deleteGroup;
  if ($('#groupRecipeForm')) $('#groupRecipeForm').onsubmit = publishGroupRecipe;
  if ($('#groupShoppingForm')) $('#groupShoppingForm').onsubmit = addShopping;
  $$('[data-delete-group-recipe]').forEach(btn => btn.onclick = () => deleteGroupRecipe(btn.dataset.deleteGroupRecipe));
  $$('[data-shop-toggle]').forEach(input => input.onchange = () => toggleShopping(input.dataset.shopToggle, input.checked));
  $$('[data-shop-delete]').forEach(btn => btn.onclick = () => deleteShopping(btn.dataset.shopDelete));
}

async function chooseRole(role) {
  if (!currentUser || !['chef','foodie'].includes(role)) return;
  const { error } = await supabase.from('user_accounts').update({ food_role: role, updated_at: new Date().toISOString() }).eq('user_id', currentUser.id);
  if (error) { toast(error.message || '身份设置失败'); return; }
  window.dispatchEvent(new CustomEvent('fansfood-account-changed'));
  toast(role === 'chef' ? '身份已设为“大厨” 👨‍🍳' : '身份已设为“美食家” 🍽️');
  await refreshGroups();
}
async function invokeGroupAction(body) {
  const { data, error } = await supabase.functions.invoke('group-actions', { body });
  if (error) {
    let message = error.message;
    try { if (error.context instanceof Response) message = (await error.context.clone().json())?.error || message; } catch {}
    throw new Error(message || '群组操作失败');
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
async function createGroup(event) {
  event.preventDefault();
  const btn = event.submitter; btn.disabled = true; btn.textContent = '创建中…';
  try {
    const data = await invokeGroupAction({ action: 'create', name: $('#createGroupName').value.trim(), description: $('#createGroupDescription').value.trim() });
    setActiveGroupId(data.group.id);
    toast('群组创建成功，已经生成邀请码');
    await refreshGroups();
  } catch (e) { toast(e.message); }
  finally { btn.disabled = false; btn.textContent = '创建群组'; }
}
async function joinGroup(event) {
  event.preventDefault();
  const btn = event.submitter; btn.disabled = true; btn.textContent = '加入中…';
  try {
    const data = await invokeGroupAction({ action: 'join', invite_code: $('#joinGroupCode').value.trim() });
    setActiveGroupId(data.group.id);
    toast(data.already_member ? '你已经在这个群组里了' : `已加入“${data.group.name}”`);
    await refreshGroups();
  } catch (e) { toast(e.message); }
  finally { btn.disabled = false; btn.textContent = '加入'; }
}
async function leaveGroup() {
  if (!activeGroup || !confirm(`确定退出“${activeGroup.name}”吗？`)) return;
  try {
    await invokeGroupAction({ action: 'leave', group_id: activeGroup.id });
    setActiveGroupId('');
    toast('已退出群组');
    await refreshGroups();
  } catch (e) { toast(e.message); }
}
async function deleteGroup() {
  if (!activeGroup || !confirm(`确定删除“${activeGroup.name}”吗？群组投票、菜谱和采购都会一起删除。`)) return;
  const { error } = await supabase.from('food_groups').delete().eq('id', activeGroup.id);
  if (error) { toast(error.message || '群组删除失败'); return; }
  setActiveGroupId('');
  toast('群组已删除');
  await refreshGroups();
}

async function publishGroupRecipe(event) {
  event.preventDefault();
  if (!activeGroup || !currentUser || !canChef()) return;
  const btn = event.submitter; btn.disabled = true; btn.textContent = '发布中…';
  let imagePath = null, imageUrl = null;
  try {
    const file = $('#groupRecipeImage').files[0];
    if (file) {
      const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase();
      imagePath = `${currentUser.id}/group-recipe-${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('dish-images').upload(imagePath, file, { cacheControl: '86400', upsert: false, contentType: file.type || undefined });
      if (uploadError) throw uploadError;
      imageUrl = supabase.storage.from('dish-images').getPublicUrl(imagePath).data.publicUrl;
    }
    const ingredients = $('#groupRecipeIngredients').value.split('\n').map(s => s.trim()).filter(Boolean);
    const steps = $('#groupRecipeSteps').value.split('\n').map(s => s.trim()).filter(Boolean);
    const { error } = await supabase.from('group_recipes').insert({
      group_id: activeGroup.id,
      name: $('#groupRecipeName').value.trim(),
      description: $('#groupRecipeDescription').value.trim(),
      category: $('#groupRecipeCategory').value,
      ingredients,
      steps,
      image_path: imagePath,
      image_url: imageUrl,
      created_by: currentUser.id,
    });
    if (error) throw error;
    event.target.reset();
    toast('菜谱已经发布到群组');
    await loadGroupData(); renderGroupsPage();
  } catch (e) {
    if (imagePath) await supabase.storage.from('dish-images').remove([imagePath]).catch(() => undefined);
    toast(e.message || '菜谱发布失败');
  } finally { btn.disabled = false; btn.textContent = '发布到群组'; }
}
async function deleteGroupRecipe(id) {
  const recipe = groupRecipes.find(r => r.id === id);
  if (!recipe || !confirm(`删除“${recipe.name}”吗？`)) return;
  const { error } = await supabase.from('group_recipes').delete().eq('id', id).eq('group_id', activeGroup.id);
  if (error) { toast('删除失败'); return; }
  if (recipe.image_path) await supabase.storage.from('dish-images').remove([recipe.image_path]).catch(() => undefined);
  await loadGroupData(); renderGroupsPage(); toast('群组菜谱已删除');
}
async function addShopping(event) {
  event.preventDefault();
  const btn = event.submitter; btn.disabled = true;
  const { error } = await supabase.from('group_shopping_items').insert({
    group_id: activeGroup.id,
    name: $('#groupShoppingName').value.trim(),
    quantity: $('#groupShoppingQty').value.trim(),
    created_by: currentUser.id,
  });
  btn.disabled = false;
  if (error) { toast(error.message || '添加失败'); return; }
  event.target.reset(); await loadGroupData(); renderGroupsPage(); toast('已加入群组采购');
}
async function toggleShopping(id, checked) {
  const { error } = await supabase.from('group_shopping_items').update({ is_checked: checked, updated_at: new Date().toISOString() }).eq('id', id).eq('group_id', activeGroup.id);
  if (error) { toast('状态更新失败'); return; }
  await loadGroupData(); renderGroupsPage();
}
async function deleteShopping(id) {
  const { error } = await supabase.from('group_shopping_items').delete().eq('id', id).eq('group_id', activeGroup.id);
  if (error) { toast('删除失败'); return; }
  await loadGroupData(); renderGroupsPage();
}

window.addEventListener('hashchange', () => { if (location.hash === '#groups') refreshGroups(); });
window.addEventListener('focus', () => { if (location.hash === '#groups') refreshGroups(); });
window.addEventListener('fansfood-account-changed', refreshGroups);
if (supabase) {
  supabase.auth.onAuthStateChange(() => setTimeout(refreshGroups, 0));
  refreshGroups();
} else renderGroupsPage();
