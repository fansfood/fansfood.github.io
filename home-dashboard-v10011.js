const HOME_VERSION = '1.0.011';

function setHomeVersion() {
  const badge = document.querySelector('.brand small');
  if (badge) badge.textContent = `v${HOME_VERSION}`;
}

function injectHomeLauncherStyles() {
  if (document.getElementById('homeLauncherV10011Styles')) return;
  const style = document.createElement('style');
  style.id = 'homeLauncherV10011Styles';
  style.textContent = `
    #home.home-launcher-page{max-width:1180px;margin:0 auto}
    .home-launcher-intro{display:flex;align-items:flex-end;justify-content:space-between;gap:22px;margin:4px 0 24px;padding:10px 2px 0}
    .home-launcher-intro h1{margin:5px 0 8px;font-size:clamp(32px,5vw,54px);line-height:1.08;letter-spacing:-1.4px}
    .home-launcher-intro p{margin:0;color:var(--muted);font-size:14px;line-height:1.75;max-width:620px}
    .home-launcher-status{display:flex;align-items:center;gap:8px;flex:none;padding:9px 12px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--muted);font-size:11px;font-weight:700;white-space:nowrap}
    .home-launcher-status i{width:7px;height:7px;border-radius:50%;background:var(--accent);display:block}
    .home-module-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
    .home-module-card{position:relative;display:flex;flex-direction:column;min-height:205px;padding:22px;border:1px solid var(--line);border-radius:24px;background:#fff;color:var(--ink);text-decoration:none;overflow:hidden;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
    .home-module-card:hover{transform:translateY(-3px);box-shadow:0 22px 54px rgba(40,49,37,.10);border-color:#cfd8ca}
    .home-module-card:active{transform:translateY(-1px)}
    .home-module-card:focus-visible{outline:3px solid rgba(95,116,85,.25);outline-offset:3px}
    .home-module-card.primary-module{grid-column:span 2;min-height:245px;padding:27px}
    .home-module-card.groups-module{background:linear-gradient(145deg,#f3f7ef,#ffffff)}
    .home-module-card.tomorrow-module{background:linear-gradient(145deg,#fff8ee,#ffffff)}
    .home-module-icon{display:grid;place-items:center;width:52px;height:52px;border-radius:17px;background:rgba(255,255,255,.86);border:1px solid rgba(220,225,216,.9);font-size:25px;box-shadow:0 8px 20px rgba(40,49,37,.05)}
    .primary-module .home-module-icon{width:61px;height:61px;border-radius:19px;font-size:30px}
    .home-module-copy{margin-top:auto;padding-top:30px;min-width:0}
    .home-module-copy small{display:block;margin-bottom:6px;color:var(--accent);font-size:10px;font-weight:900;letter-spacing:1.1px;text-transform:uppercase}
    .home-module-copy h2{margin:0 0 7px;font-size:24px;line-height:1.2;letter-spacing:-.3px}
    .primary-module .home-module-copy h2{font-size:30px}
    .home-module-copy p{margin:0;padding-right:28px;color:var(--muted);font-size:12px;line-height:1.65}
    .primary-module .home-module-copy p{font-size:13px;max-width:460px}
    .home-module-arrow{position:absolute;right:19px;bottom:18px;display:grid;place-items:center;width:33px;height:33px;border-radius:50%;background:#f3f5f0;color:var(--accent);font-size:19px;font-weight:800;transition:transform .18s ease,background .18s ease}
    .primary-module .home-module-arrow{right:24px;bottom:23px;width:39px;height:39px;font-size:22px;background:rgba(255,255,255,.85)}
    .home-module-card:hover .home-module-arrow{transform:translateX(3px)}
    .home-module-badge{position:absolute;right:18px;top:18px;padding:6px 9px;border-radius:999px;background:#f3f5f0;color:#6a7166;font-size:10px;font-weight:800}
    .primary-module .home-module-badge{right:22px;top:22px;background:rgba(255,255,255,.78)}
    .home-quick-note{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:16px;padding:15px 18px;border:1px dashed var(--line);border-radius:18px;color:var(--muted);font-size:12px;background:#fafbf8}
    .home-quick-note b{color:var(--ink)}
    .home-quick-note a{color:var(--accent);font-weight:800;text-decoration:none;white-space:nowrap}
    @media(max-width:850px){
      .home-module-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
      .home-module-card.primary-module{grid-column:span 1;min-height:230px}
      .home-launcher-intro{align-items:flex-start;flex-direction:column}
    }
    @media(max-width:600px){
      #home.home-launcher-page{padding-top:2px}
      .home-launcher-intro{margin-bottom:18px;gap:12px}
      .home-launcher-intro h1{font-size:34px;letter-spacing:-.8px}
      .home-launcher-intro p{font-size:13px}
      .home-launcher-status{padding:7px 10px}
      .home-module-grid{gap:10px}
      .home-module-card{min-height:154px;padding:16px;border-radius:20px}
      .home-module-card.primary-module{grid-column:1/-1;min-height:185px;padding:20px}
      .home-module-icon{width:43px;height:43px;border-radius:14px;font-size:21px}
      .primary-module .home-module-icon{width:50px;height:50px;border-radius:16px;font-size:25px}
      .home-module-copy{padding-top:22px}
      .home-module-copy small{font-size:8px;margin-bottom:4px;letter-spacing:.8px}
      .home-module-copy h2{font-size:19px;margin-bottom:5px}
      .primary-module .home-module-copy h2{font-size:25px}
      .home-module-copy p{font-size:10.5px;line-height:1.5;padding-right:16px}
      .primary-module .home-module-copy p{font-size:12px;padding-right:36px}
      .home-module-arrow{right:12px;bottom:12px;width:27px;height:27px;font-size:16px}
      .primary-module .home-module-arrow{right:16px;bottom:16px;width:34px;height:34px;font-size:19px}
      .home-module-badge{right:12px;top:12px;font-size:8px;padding:5px 7px}
      .primary-module .home-module-badge{right:16px;top:16px}
      .home-quick-note{align-items:flex-start;flex-direction:column;margin-top:12px;padding:13px 15px;font-size:11px}
    }
  `;
  document.head.appendChild(style);
}

const modules = [
  {
    href: '#groups',
    cls: 'primary-module groups-module',
    icon: '👥',
    eyebrow: 'MY GROUPS',
    title: '我的群组',
    desc: '创建或加入小饭桌，管理成员、群内菜谱、投票与采购。',
    badge: '饭桌中心'
  },
  {
    href: '#tomorrow',
    cls: 'primary-module tomorrow-module',
    icon: '🍽️',
    eyebrow: 'TOMORROW',
    title: '明天吃什么',
    desc: '美食家提交想吃的菜，大厨直接查看本群投票汇总。',
    badge: '群组投票'
  },
  {
    href: '#recipes',
    cls: '',
    icon: '📖',
    eyebrow: 'RECIPES',
    title: '菜谱',
    desc: '浏览做法、口味和食材，也可以上传自己的菜谱。',
    badge: '做什么'
  },
  {
    href: '#menu',
    cls: '',
    icon: '📅',
    eyebrow: 'WEEKLY PLAN',
    title: '本周菜单',
    desc: '安排一周三餐，把想吃的菜真正排进日程。',
    badge: '吃什么'
  },
  {
    href: '#shopping',
    cls: '',
    icon: '🧾',
    eyebrow: 'SHOPPING',
    title: '采购',
    desc: '按采购日期整理清单，买完一项就勾掉一项。',
    badge: '买什么'
  },
  {
    href: '#pantry',
    cls: '',
    icon: '🧊',
    eyebrow: 'PANTRY',
    title: '我的冰箱',
    desc: '记录现有食材和库存，减少重复购买与浪费。',
    badge: '有什么'
  }
];

function renderHomeLauncher() {
  const home = document.getElementById('home');
  if (!home || home.dataset.launcherV10011 === '1') return;
  home.dataset.launcherV10011 = '1';
  home.classList.add('home-launcher-page');
  home.innerHTML = `
    <div class="home-launcher-intro">
      <div>
        <span class="eyebrow">SHIGUANG</span>
        <h1>今天想做什么？</h1>
        <p>把复杂功能留在里面，主页只负责带你快速到达。选择一个模块，就开始今天的饭桌安排。</p>
      </div>
      <div class="home-launcher-status"><i></i><span>登录后自动同步</span></div>
    </div>
    <div class="home-module-grid">
      ${modules.map(item => `
        <a class="home-module-card ${item.cls}" href="${item.href}" aria-label="进入${item.title}">
          <span class="home-module-icon" aria-hidden="true">${item.icon}</span>
          <span class="home-module-badge">${item.badge}</span>
          <div class="home-module-copy">
            <small>${item.eyebrow}</small>
            <h2>${item.title}</h2>
            <p>${item.desc}</p>
          </div>
          <span class="home-module-arrow" aria-hidden="true">→</span>
        </a>`).join('')}
    </div>
    <div class="home-quick-note">
      <span><b>食光现在更像一个入口页。</b> 首页不再堆今日菜单和统计，具体内容进入对应模块再看。</span>
      <a href="#groups">从我的群组开始 →</a>
    </div>`;
}

function initHomeLauncher() {
  injectHomeLauncherStyles();
  setHomeVersion();
  const run = () => {
    renderHomeLauncher();
    setHomeVersion();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(run, 650), { once: true });
  } else {
    setTimeout(run, 650);
  }
  setTimeout(setHomeVersion, 1600);
  window.addEventListener('hashchange', setHomeVersion);
  window.addEventListener('focus', setHomeVersion);
}

initHomeLauncher();
