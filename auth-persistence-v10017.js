import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const VERSION = '1.0.017';
const cfg = window.SHIGUANG_CONFIG || {};
const supabase = cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY
  ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage
      }
    })
  : null;

let restoring = false;
let lastUserId = null;

function setVersion() {
  const badge = document.querySelector('.brand small');
  if (badge) badge.textContent = `v${VERSION}`;
}

function markConnected(session) {
  if (!session) return;
  const pill = document.getElementById('cloudPill');
  if (pill) {
    pill.textContent = '云端已连接';
    pill.classList.add('online');
  }
}

function notifyRestored(session) {
  if (!session?.user) return;
  const changed = lastUserId !== session.user.id;
  lastUserId = session.user.id;
  window.dispatchEvent(new CustomEvent('fansfood-account-changed', {
    detail: { restored: true, userId: session.user.id, changed }
  }));
}

async function restoreSession() {
  if (!supabase || restoring) return;
  restoring = true;
  try {
    let { data, error } = await supabase.auth.getSession();
    if (error) return;
    let session = data.session;
    if (!session) {
      lastUserId = null;
      return;
    }

    const expiresAt = Number(session.expires_at || 0);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (expiresAt && expiresAt - nowSeconds < 300) {
      const refreshed = await supabase.auth.refreshSession();
      if (!refreshed.error && refreshed.data.session) session = refreshed.data.session;
    }

    markConnected(session);
    notifyRestored(session);
  } catch (error) {
    console.warn('食光自动恢复登录失败', error);
  } finally {
    restoring = false;
    setVersion();
  }
}

function init() {
  setVersion();
  setTimeout(restoreSession, 250);
  setTimeout(restoreSession, 1200);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) restoreSession();
  });
  window.addEventListener('focus', () => {
    setVersion();
    restoreSession();
  });
  window.addEventListener('online', restoreSession);
  window.addEventListener('hashchange', setVersion);

  if (supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        lastUserId = null;
        return;
      }
      if (session) {
        markConnected(session);
        notifyRestored(session);
      }
      setVersion();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
