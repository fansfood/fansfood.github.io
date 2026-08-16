import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const $ = s => document.querySelector(s);
const cfg = window.SHIGUANG_CONFIG || {};
const supabase = cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY
  ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY)
  : null;

let authMode = 'login';
let currentUser = null;
let profile = null;
let isAdmin = false;

function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._accountTimer);
  el._accountTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
function esc(value = '') {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[ch]);
}
function isInternalEmail(email) { return /@users\.fansfood\.invalid$/i.test(String(email || '')); }
function roleLabel(role) { return role === 'chef' ? '大厨' : role === 'foodie' ? '美食家' : '未选择'; }
function roleEmoji(role) { return role === 'chef' ? '👨‍🍳' : role === 'foodie' ? '🍽️' : '👤'; }

async function syncSession() {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  currentUser = data.session?.user || null;
  await loadProfile();
  await checkAdmin();
}
async function loadProfile() {
  profile = null;
  if (!currentUser || !supabase) return;
  let { data, error } = await supabase
    .from('user_accounts')
    .select('user_id,username,bound_email,email_verified,food_role')
    .eq('user_id', currentUser.id)
    .maybeSingle();
  if (error) return;
  if (!data) {
    const realEmail = currentUser.email && !isInternalEmail(currentUser.email) ? currentUser.email : null;
    const created = await supabase
      .from('user_accounts')
      .insert({ user_id:currentUser.id, bound_email:realEmail, email_verified:Boolean(realEmail && currentUser.email_confirmed_at) })
      .select('user_id,username,bound_email,email_verified,food_role')
      .single();
    if (!created.error) data = created.data;
  }
  profile = data || null;
}
async function checkAdmin() {
  isAdmin = false;
  if (!currentUser || !supabase) return;
  const { data } = await supabase.from('site_admins').select('user_id').eq('user_id', currentUser.id).maybeSingle();
  isAdmin = Boolean(data);
}
async function functionErrorMessage(error) {
  try {
    if (error?.context instanceof Response) {
      const body = await error.context.clone().json();
      return body?.error || error.message;
    }
  } catch {}
  return error?.message || '请求失败';
}
async function openAccount() {
  const dialog = $('#accountDialog'); if (!dialog) return;
  await syncSession(); renderAccount(); if (!dialog.open) dialog.showModal();
}

function signupRoleHtml() {
  return `<div class="signup-role-block"><span class="auth-field-title">选择你的身份</span><div class="identity-choice-grid compact-role-grid">
    <label class="identity-card role-radio"><input type="radio" name="signupFoodRole" value="chef" required><span>👨‍🍳</span><b>我是大厨</b><small>创建群组、查看食客投票、发布菜谱、管理采购</small></label>
    <label class="identity-card role-radio"><input type="radio" name="signupFoodRole" value="foodie" required><span>🍽️</span><b>我是美食家</b><small>加入群组、浏览菜谱、参与“明天吃什么”投票</small></label>
  </div></div>`;
}

function renderAccount() {
  const panel = $('#accountPanel'); if (!panel) return;
  if (!supabase) {
    panel.innerHTML = '<span class="eyebrow">CLOUD</span><h2>云端暂不可用</h2><p>请稍后再试。</p>';
    return;
  }

  if (currentUser) {
    const username = profile?.username || '';
    const email = profile?.bound_email || '';
    const role = profile?.food_role || '';
    panel.innerHTML = `
      <span class="eyebrow">ACCOUNT</span>
      <h2>食光账户${isAdmin ? ' · 站长' : ''}</h2>
      <p>身份决定你在群组里的权限。大厨负责菜单与管理，美食家负责选择与反馈。</p>
      <div class="account-identity-card ${role || 'unset'}">
        <span>${roleEmoji(role)}</span><div><small>我的身份</small><b>${roleLabel(role)}</b></div>
        <a href="#groups" id="accountGoGroups">我的群组 →</a>
      </div>
      <div class="account-info"><b>${username ? '@' + esc(username) : '还没有设置账号名'}</b><span>${email ? `邮箱：${esc(email)}${profile?.email_verified ? ' · 已验证' : ' · 待验证'}` : '暂未绑定邮箱'}</span><span>用户 ID：${currentUser.id.slice(0,8)}…</span></div>
      <form class="auth-form" id="accountProfileForm">
        <label>账号名<input id="accountUsername" type="text" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" required value="${esc(username)}" placeholder="例如 fans001"></label>
        <label>我的身份<select id="accountFoodRole" required><option value="" ${!role ? 'selected' : ''}>请选择</option><option value="chef" ${role === 'chef' ? 'selected' : ''}>👨‍🍳 大厨</option><option value="foodie" ${role === 'foodie' ? 'selected' : ''}>🍽️ 美食家（食客）</option></select></label>
        <div class="role-explainer"><div><b>👨‍🍳 大厨</b><span>可创建群组、查看本群食客投票、发布群组菜谱、维护群组采购。</span></div><div><b>🍽️ 美食家</b><span>可加入群组、浏览菜谱并参与“明天吃什么”。</span></div></div>
        <label>绑定邮箱 <small>可选</small><input id="accountEmail" type="email" value="${esc(email)}" placeholder="以后可用于找回账号"></label>
        <div class="auth-help">如果你是某个群组的群主，系统会阻止你直接从“大厨”切换成“美食家”，以免群组失去管理者。</div>
        <button class="btn primary" type="submit">保存账户设置</button>
      </form>
      ${isAdmin ? '<button class="btn ghost" id="accountManageDishes">管理当前群组投票菜品</button>' : ''}
      <button class="btn danger" id="accountLogout">退出登录</button>`;
    $('#accountProfileForm').onsubmit = saveProfile;
    $('#accountLogout').onclick = async () => {
      await supabase.auth.signOut(); currentUser = null; profile = null; isAdmin = false;
      $('#accountDialog').close(); window.dispatchEvent(new CustomEvent('fansfood-account-changed')); toast('已退出账户');
    };
    $('#accountGoGroups').onclick = () => $('#accountDialog').close();
    if (isAdmin) $('#accountManageDishes').onclick = () => { $('#accountDialog').close(); location.hash = '#tomorrow'; setTimeout(() => $('#manageDishesBtn')?.click(), 100); };
    return;
  }

  const login = authMode === 'login';
  panel.innerHTML = `
    <span class="eyebrow">WELCOME</span><h2>${login ? '登录食光' : '创建食光账号'}</h2>
    <p>${login ? '输入账号名和密码即可登录；之前注册的邮箱账号仍可继续用邮箱登录。' : '注册只需要账号名、密码和一个食光身份，邮箱以后再绑定。'}</p>
    <div class="auth-tabs"><button id="accountTabLogin" class="${login ? 'active' : ''}">登录</button><button id="accountTabSignup" class="${!login ? 'active' : ''}">注册</button></div>
    <form class="auth-form" id="accountAuthForm">
      <label>${login ? '账号 / 邮箱' : '账号名'}<input id="accountIdentifier" type="text" autocomplete="username" minlength="3" maxlength="80" required placeholder="${login ? '输入账号名' : '3–24 位字母、数字或下划线'}"></label>
      <label>密码<input id="accountPassword" type="password" minlength="${login ? 6 : 8}" maxlength="128" autocomplete="${login ? 'current-password' : 'new-password'}" required placeholder="${login ? '输入密码' : '至少 8 位'}"></label>
      ${login ? '' : signupRoleHtml()}
      <button class="btn primary" type="submit">${login ? '登录' : '注册并登录'}</button>
      <div class="auth-help">${login ? '登录后会自动读取你的身份和群组。' : '大厨和美食家都可以加入多个群组；身份会在所有群组中保持一致。'}</div>
    </form>`;
  $('#accountTabLogin').onclick = () => { authMode = 'login'; renderAccount(); };
  $('#accountTabSignup').onclick = () => { authMode = 'signup'; renderAccount(); };
  $('#accountAuthForm').onsubmit = submitAuth;
}

async function submitAuth(event) {
  event.preventDefault();
  const identifier = $('#accountIdentifier').value.trim();
  const password = $('#accountPassword').value;
  const role = authMode === 'signup' ? document.querySelector('input[name="signupFoodRole"]:checked')?.value : null;
  if (authMode === 'signup' && !role) { toast('请选择“大厨”或“美食家”身份'); return; }
  const button = event.submitter; button.disabled = true; button.textContent = '处理中…';
  try {
    const action = authMode === 'signup' ? 'register' : 'login';
    const { data, error } = await supabase.functions.invoke('username-auth', { body: { action, identifier, username:identifier, password, food_role:role } });
    if (error) throw new Error(await functionErrorMessage(error));
    if (data?.error) throw new Error(data.error);
    if (!data?.session?.access_token || !data?.session?.refresh_token) throw new Error('未能建立登录会话，请重试');
    const { error: sessionError } = await supabase.auth.setSession({ access_token:data.session.access_token, refresh_token:data.session.refresh_token });
    if (sessionError) throw sessionError;
    await syncSession(); renderAccount(); window.dispatchEvent(new CustomEvent('fansfood-account-changed'));
    toast(authMode === 'signup' ? `注册成功 · ${roleLabel(role)}` : '登录成功');
  } catch (error) { toast(error?.message || '操作失败'); }
  finally { button.disabled = false; if (!currentUser) button.textContent = authMode === 'signup' ? '注册并登录' : '登录'; }
}

async function saveProfile(event) {
  event.preventDefault();
  if (!currentUser || !supabase) return;
  const username = $('#accountUsername').value.trim().toLowerCase();
  const email = $('#accountEmail').value.trim();
  const role = $('#accountFoodRole').value;
  if (!/^[a-z0-9_]{3,24}$/.test(username)) { toast('账号需为 3–24 位，只能包含字母、数字和下划线'); return; }
  if (!['chef','foodie'].includes(role)) { toast('请选择“大厨”或“美食家”身份'); return; }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('邮箱格式不正确'); return; }
  const emailChanged = email !== (profile?.bound_email || '');
  const button = event.submitter; button.disabled = true; button.textContent = '保存中…';
  const { data, error } = await supabase.from('user_accounts').update({ username, bound_email:email || null, food_role:role, updated_at:new Date().toISOString() }).eq('user_id', currentUser.id).select('user_id,username,bound_email,email_verified,food_role').single();
  button.disabled = false; button.textContent = '保存账户设置';
  if (error) {
    const message = error.code === '23505' ? '这个账号名已经被使用' : (error.message || '保存失败');
    toast(message.includes('群主') ? '你还是群主，暂时不能切换成美食家' : message); return;
  }
  profile = data; renderAccount(); window.dispatchEvent(new CustomEvent('fansfood-account-changed'));
  toast(emailChanged && email ? '账户已保存；新邮箱当前为待验证' : `账户设置已保存 · ${roleLabel(role)}`);
}

function installHandlers() {
  const accountBtn = $('#accountBtn'); if (accountBtn) accountBtn.onclick = openAccount;
  const close = $('#accountClose'); if (close) close.onclick = () => $('#accountDialog')?.close();
  const newRecipeBtn = $('#newRecipeBtn'); if (newRecipeBtn) newRecipeBtn.onclick = async () => {
    await syncSession();
    if (!currentUser) { toast('登录后可以把食谱和图片保存到云端'); await openAccount(); return; }
    $('#newRecipeDialog')?.showModal();
  };
}
installHandlers();
if (supabase) supabase.auth.onAuthStateChange(async () => { await syncSession(); if ($('#accountDialog')?.open) renderAccount(); });
