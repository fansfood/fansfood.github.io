(() => {
  const flagNames = new Set(['重点','考试','没听懂','例子']);
  let scheduled = false;
  let deferredInstallPrompt = null;

  function applyFlagColors(){
    document.querySelectorAll('.meta b, .review-meta b').forEach((badge) => {
      const name = badge.textContent.trim();
      if(flagNames.has(name)) badge.dataset.flag = name;
    });
  }

  function moveNotesBelowButton(){
    const review = document.getElementById('reviewArea');
    const output = document.getElementById('notesOutput');
    if(!review || !output) return;
    const note = review.querySelector('.generated-notes');
    if(note){
      output.hidden = false;
      output.replaceChildren(note);
    } else if(!output.querySelector('.generated-notes')) {
      output.hidden = true;
    }
  }

  function reorderAuthCard(){
    const form = document.getElementById('authForm');
    const hint = document.querySelector('.auth-card .auth-hint');
    if(!form || !hint) return;
    if(form.nextElementSibling !== hint) form.insertAdjacentElement('afterend', hint);
  }

  function isStandalone(){
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function isIOS(){
    return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function installStyle(){
    if(document.getElementById('classflowInstallStyle')) return;
    const style = document.createElement('style');
    style.id = 'classflowInstallStyle';
    style.textContent = `
      .classflow-install-button{display:inline-flex;align-items:center;justify-content:center;gap:.45rem}
      .classflow-install-button::before{content:'↓';font-weight:800}
      .auth-card #authForm{margin-bottom:0}
      .auth-card .auth-hint{margin:12px 0 0}
      .auth-card #installAppAuth{margin-top:12px}
      .auth-card #signupButton{margin-top:2px}
      .classflow-install-mask{position:fixed;inset:0;z-index:9999;background:rgba(11,18,14,.62);backdrop-filter:blur(8px);display:grid;place-items:center;padding:20px}
      .classflow-install-card{width:min(92vw,430px);border-radius:24px;background:#f7f7f1;color:#17211b;box-shadow:0 28px 80px rgba(0,0,0,.28);padding:24px}
      .classflow-install-card h2{margin:0 0 10px;font-size:22px}
      .classflow-install-card p{margin:8px 0;line-height:1.65;color:#465048}
      .classflow-install-card ol{margin:14px 0 20px;padding-left:22px;line-height:1.8}
      .classflow-install-card button{width:100%;min-height:44px;border:0;border-radius:14px;background:#17211b;color:#fff;font-weight:700;cursor:pointer}
    `;
    document.head.appendChild(style);
  }

  function hideInstallButtons(){
    document.querySelectorAll('.classflow-install-button').forEach((button) => button.remove());
  }

  function showInstallHelp(){
    installStyle();
    document.getElementById('classflowInstallMask')?.remove();
    const mask = document.createElement('div');
    mask.id = 'classflowInstallMask';
    mask.className = 'classflow-install-mask';
    const card = document.createElement('section');
    card.className = 'classflow-install-card';

    if(isIOS()){
      card.innerHTML = `
        <h2>安装 ClassFlow 到 iPhone / iPad</h2>
        <p>请使用 Safari 打开 ClassFlow，然后：</p>
        <ol><li>点击底部或顶部的“分享”按钮。</li><li>选择“添加到主屏幕 / Add to Home Screen”。</li><li>点击“添加”。</li></ol>
        <p>安装后 ClassFlow 会以独立 App 窗口打开，课堂记录和登录状态仍会保留。</p>
        <button type="button">知道了 / Got it</button>`;
    } else {
      card.innerHTML = `
        <h2>安装 ClassFlow App</h2>
        <p>当前浏览器没有弹出系统安装框。你仍可以从浏览器菜单安装：</p>
        <ol><li>打开浏览器菜单。</li><li>选择“安装应用 / Install app”或“添加到主屏幕 / Add to Home screen”。</li><li>确认安装 ClassFlow。</li></ol>
        <button type="button">知道了 / Got it</button>`;
    }
    card.querySelector('button').onclick = () => mask.remove();
    mask.onclick = (event) => { if(event.target === mask) mask.remove(); };
    mask.appendChild(card);
    document.body.appendChild(mask);
  }

  async function requestInstall(){
    if(isStandalone()){
      hideInstallButtons();
      return;
    }
    if(deferredInstallPrompt){
      deferredInstallPrompt.prompt();
      try{
        const choice = await deferredInstallPrompt.userChoice;
        if(choice?.outcome === 'accepted') hideInstallButtons();
      } catch {}
      deferredInstallPrompt = null;
      return;
    }
    showInstallHelp();
  }

  function createInstallButton(id, className, label){
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.className = `${className} classflow-install-button`;
    button.textContent = label;
    button.onclick = requestInstall;
    return button;
  }

  function ensureInstallButtons(){
    if(isStandalone()){
      hideInstallButtons();
      return;
    }
    installStyle();

    const authForm = document.getElementById('authForm');
    const authHint = document.querySelector('.auth-card .auth-hint');
    if(authForm && !document.getElementById('installAppAuth')){
      const button = createInstallButton('installAppAuth', 'secondary wide', '安装 ClassFlow App / Install App');
      if(authHint) authHint.insertAdjacentElement('afterend', button);
      else authForm.insertAdjacentElement('afterend', button);
    }

    const topActions = document.querySelector('.top-actions');
    if(topActions && !document.getElementById('installAppTop')){
      const button = createInstallButton('installAppTop', 'ghost compact', '安装 App / Install');
      topActions.insertBefore(button, topActions.firstChild);
    }
  }

  function sync(){
    scheduled = false;
    applyFlagColors();
    moveNotesBelowButton();
    reorderAuthCard();
    ensureInstallButtons();
  }

  function schedule(){
    if(scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    schedule();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    hideInstallButtons();
  });

  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', schedule);

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, {once:true});
  else schedule();

  new MutationObserver(schedule).observe(document.documentElement, {subtree:true, childList:true, characterData:true});

  // Beta-only v10 loader. Stable ClassFlow is untouched.
  if(location.pathname.includes('/classflow-beta/')){
    const loadV10 = () => {
      document.title = 'ClassFlow Beta 2.0 · v10 · 云端课堂翻译';
      document.querySelectorAll('.eyebrow,.subtitle-zh,.subtitle-en').forEach((el) => {
        el.textContent = el.textContent.replace(/v9/g,'v10');
      });
      if(!document.getElementById('classflowPriorityV10')){
        const script = document.createElement('script');
        script.id = 'classflowPriorityV10';
        script.src = './priority-v10.js?v=10';
        script.defer = true;
        document.body.appendChild(script);
      }
    };
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadV10, {once:true});
    else loadV10();
  }
})();
