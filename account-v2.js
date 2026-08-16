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

function isInternalEmail(email) {
  return /@users\.fansfood\.invalid$/i.test(String(email || ''));
}

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
    .select('user_id,username,bound_email,email_verified')
    .eq('user_id', currentUser.id)
    .maybeSingle();
  if (error) return;
  if (!data) {
    const realEmail = currentUser.email && !isInternalEmail(currentUser.email) ? currentUser.email : null;
    const created = await supabase
      .from('user_accounts')
      .insert({
        user_id: currentUser.id,
        bound_email: realEmail,
        email_verified: Boolean(realEmail && currentUser.email_confirmed_at),
      })
      .select('user_id,username,bound_email,email_verified')
      .single();
    if (!created.error) data = created.data;
  }
  profile = data || null;
}

async function checkAdmin() {
  isAdmin = false;
  if (!currentUser || !supabase) return;
  const { data } = await supabase
    .from('site_admins')
    .select('user_id')
    .eq('user_id', currentUser.id)
    .maybeSingle();
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
  const dialog = $('#accountDialog');
  if (!dialog) return;
  await syncSession();
  renderAccount();
  if (!dialog.open) dialog.showModal();
}

function renderAccount() {
  const panel = $('#accountPanel');
  if (!panel) return;
  if (!supabase) {
    panel.innerHTML = '<span class="eyebrow">CLOUD</span><h2>云端暂不可用</h2><p>请稍后再试。</p>';
    return;
  }

  if (currentUser) {
    const username = profile?.username || '';
    const email = profile?.bound_email || '';
    panel.innerHTML = `
      <span class="eyebrow">ACCOUNT</span>
      <h2>食光账户${isAdmin ? ' · 管理员' : ''}</h2>
      <p>${isAdmin ? '你可以上传菜品照片、管理“明天吃什么”并查看汇总。' : '这个账号的数据会在手机和电脑之间同步。'}</p>
      <div class="account-info">
        <b>${username ? '@' + username : '还没有设置账号名'}</b>
        <span>${email ? `邮箱：${email}${profile?.email_verified ? ' · 已验证' : ' · 待验证'}` : '暂未绑定邮箱'}</span>
        <span>用户 ID：${currentUser.id.slice(0, 8)}…</span>
      </div>
      <form class="auth-form" id="accountProfileForm">
        <label>账号名
          <input id="accountUsername" type="text" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" required value="${username}" placeholder="例如 fans001">
        </label>
        <label>绑定邮箱 <small>可选</small>
          <input id="accountEmail" type="email" value="${email}" placeholder="以后可用于找回账号">
        </label>
        <div class="auth-help">账号名用于日常登录。新填写的邮箱会先标记为“待验证”，不会替代账号登录。</div>
        <button class="btn primary" type="submit">保存账户设置</button>
      </form>
      ${isAdmin ? '<button class="btn ghost" id="accountManageDishes">管理投票菜品</button>' : ''}
      <button class="btn danger" id="accountLogout">退出登录</button>
    `;
    $('#accountProfileForm').onsubmit = saveProfile;
    $('#accountLogout').onclick = async () => {
      await supabase.auth.signOut();
      currentUser = null;
      profile = null;
      isAdmin = false;
      $('#accountDialog').close();
      toast('已退出账户');
    };
    if (isAdmin) {
      $('#accountManageDishes').onclick = () => {
        $('#accountDialog').close();
        $('#manageDishesBtn')?.click();
      };
    }
    return;
  }

  const login = authMode === 'login';
  panel.innerHTML = `
    <span class="eyebrow">WELCOME</span>
    <h2>${login ? '登录食光' : '创建食光账号'}</h2>
    <p>${login ? '输入账号名和密码即可登录；之前注册的邮箱账号仍可继续用邮箱登录。' : '现在注册不需要邮箱，先创建账号名和密码即可。'}</p>
    <div class="auth-tabs">
      <button id="accountTabLogin" class="${login ? 'active' : ''}">登录</button>
      <button id="accountTabSignup" class="${!login ? 'active' : ''}">注册</button>
    </div>
    <form class="auth-form" id="accountAuthForm">
      <label>${login ? '账号 / 邮箱' : '账号名'}
        <input id="accountIdentifier" type="text" autocomplete="username" minlength="3" maxlength="80" required placeholder="${login ? '输入账号名' : '3–24 位字母、数字或下划线'}">
      </label>
      <label>密码
        <input id="accountPassword" type="password" minlength="${login ? 6 : 8}" maxlength="128" autocomplete="${login ? 'current-password' : 'new-password'}" required placeholder="${login ? '输入密码' : '至少 8 位'}">
      </label>
      <button class="btn primary" type="submit">${login ? '登录' : '注册并登录'}</button>
      <div class="auth-help">注册无需邮箱。以后可以进入账户设置，再绑定自己的邮箱。</div>
    </form>
  `;
  $('#accountTabLogin').onclick = () => { authMode = 'login'; renderAccount(); };
  $('#accountTabSignup').onclick = () => { authMode = 'signup'; renderAccount(); };
  $('#accountAuthForm').onsubmit = submitAuth;
}

async function submitAuth(event) {
  event.preventDefault();
  const identifier = $('#accountIdentifier').value.trim();
  const password = $('#accountPassword').value;
  const button = event.submitter;
  button.disabled = true;
  button.textContent = '处理中…';
  try {
    const action = authMode === 'signup' ? 'register' : 'login';
    const { data, error } = await supabase.functions.invoke('username-auth', {
      body: { action, identifier, username: identifier, password },
    });
    if (error) throw new Error(await functionErrorMessage(error));
    if (data?.error) throw new Error(data.error);
    if (!data?.session?.access_token || !data?.session?.refresh_token) throw new Error('未能建立登录会话，请重试');
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (sessionError) throw sessionError;
    await syncSession();
    renderAccount();
    toast(authMode === 'signup' ? '注册成功，已登录' : '登录成功');
  } catch (error) {
    toast(error?.message || '操作失败');
  } finally {
    button.disabled = false;
    if (!currentUser) button.textContent = authMode === 'signup' ? '注册并登录' : '登录';
  }
}

async function saveProfile(event) {
  event.preventDefault();
  if (!currentUser || !supabase) return;
  const username = $('#accountUsername').value.trim().toLowerCase();
  const email = $('#accountEmail').value.trim();
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    toast('账号需为 3–24 位，只能包含字母、数字和下划线');
    return;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    toast('邮箱格式不正确');
    return;
  }
  const emailChanged = email !== (profile?.bound_email || '');
  const button = event.submitter;
  button.disabled = true;
  button.textContent = '保存中…';
  const { data, error } = await supabase
    .from('user_accounts')
    .upsert({
      user_id: currentUser.id,
      username,
      bound_email: email || null,
      email_verified: emailChanged ? false : Boolean(profile?.email_verified),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select('user_id,username,bound_email,email_verified')
    .single();
  button.disabled = false;
  button.textContent = '保存账户设置';
  if (error) {
    toast(error.code === '23505' ? '这个账号名已经被使用' : (error.message || '保存失败'));
    return;
  }
  profile = data;
  renderAccount();
  toast(emailChanged && email ? '账号已保存；新邮箱当前为待验证' : '账户设置已保存');
}

function installHandlers() {
  const accountBtn = $('#accountBtn');
  if (accountBtn) accountBtn.onclick = openAccount;
  const close = $('#accountClose');
  if (close) close.onclick = () => $('#accountDialog')?.close();

  const newRecipeBtn = $('#newRecipeBtn');
  if (newRecipeBtn) {
    newRecipeBtn.onclick = async () => {
      await syncSession();
      if (!currentUser) {
        toast('登录后可以把食谱和图片保存到云端');
        await openAccount();
        return;
      }
      $('#newRecipeDialog')?.showModal();
    };
  }
}

installHandlers();
if (supabase) {
  supabase.auth.onAuthStateChange(async () => {
    await syncSession();
    if ($('#accountDialog')?.open) renderAccount();
  });
}
