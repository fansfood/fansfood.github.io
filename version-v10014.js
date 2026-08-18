const APP_VERSION = '1.0.015';

function applyVersion() {
  const badge = document.querySelector('.brand small');
  if (badge && badge.textContent !== `v${APP_VERSION}`) badge.textContent = `v${APP_VERSION}`;
}

function watchVersion() {
  applyVersion();
  const badge = document.querySelector('.brand small');
  if (badge) {
    new MutationObserver(applyVersion).observe(badge, { childList:true, characterData:true, subtree:true });
  }
  window.addEventListener('hashchange', applyVersion);
  window.addEventListener('focus', applyVersion);
  setTimeout(applyVersion, 500);
  setTimeout(applyVersion, 1500);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchVersion, { once:true });
else watchVersion();
