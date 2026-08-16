import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const VERSION = '1.0.012';
const cfg = window.SHIGUANG_CONFIG || {};
const supabase = cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY
  ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY)
  : null;

const WEEK_NAMES = ['周日','周一','周二','周三','周四','周五','周六'];
let choosingInitialDay = false;
let tabsBusy = false;

function setVersion() {
  const badge = document.querySelector('.brand small');
  if (badge) badge.textContent = `v${VERSION}`;
}

function rollingDays() {
  const result = [];
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    result.push({
      offset: i,
      key: WEEK_NAMES[d.getDay()],
      date: d,
      month: d.getMonth() + 1,
      day: d.getDate(),
      relative: i === 0 ? '今天' : i === 1 ? '明天' : i === 2 ? '后天' : WEEK_NAMES[d.getDay()]
    });
  }
  return result;
}

function injectStyles() {
  if (document.getElementById('homeLauncherV10012Styles')) return;
  const style = document.createElement('style');
  style.id = 'homeLauncherV10012Styles';
  style.textContent = `
    #home.home-launcher-page{max-width:1180px;margin:0 auto}
    .home-runtime-compat{display:none!important}
    .home-launcher-intro{display:flex;align-items:flex-end;justify-content:space-between;gap:22px;margin:2px 0 26px;padding:14px 2px 0}
    .home-launcher-intro .eyebrow{letter-spacing:1.35px}
    .home-launcher-intro h1{margin:6px 0 9px;font-size:clamp(40px,6vw,64px);line-height:1.04;letter-spacing:-1.8px}
    .home-launcher-intro p{margin:0;color:var(--muted);font-size:14px;line-height:1.75;max-width:650px}
    .home-launcher-status{display:flex;align-items:center;gap:8px;flex:none;padding:10px 13px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--muted);font-size:11px;font-weight:800;white-space:nowrap}
    .home-launcher-status i{width:7px;height:7px;border-radius:50%;background:var(--accent);display:block}
    .home-module-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
    .home-module-card{position:relative;display:flex;flex-direction:column;min-height:205px;padding:22px;border:1px solid var(--line);border-radius:24px;background:#fff;color:var(--ink);text-decoration:none;overflow:hidden;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
    .home-module-card:hover{transform:translateY(-3px);box-shadow:0 22px 54px rgba(40,49,37,.10);border-color:#cfd8ca}
    .home-module-card:active{transform:translateY(-1px)}
    .home-module-card:focus-visible{outline:3px solid rgba(95,116,85,.25);outline-offset:3px}
    .home-module-card.primary-module{grid-column:span 2;min-height:245px;padding:27px}
    .home-module-card.groups-module{background:linear-gradient(145deg,#f1f6ed,#ffffff)}
    .home-module-card.seven-module{background:linear-gradient(145deg,#fff7ea,#ffffff)}
    .home-module-card.tomorrow-module{background:linear-gradient(145deg,#fff9f2,#ffffff)}
    .home-module-icon{display:grid;place-items:center;width:52px;height:52px;border-radius:17px;background:rgba(255,255,255,.88);border:1px solid rgba(220,225,216,.9);font-size:25px;box-shadow:0 8px 20px rgba(40,49,37,.05)}
    .primary-module .home-module-icon{width:61px;height:61px;border-radius:19px;font-size:30px}
    .home-module-copy{margin-top:auto;padding-top:30px;min-width:0}
    .home-module-copy small{display:block;margin-bottom:6px;color:var(--accent);font-size:10px;font-weight:900;letter-spacing:1.1px;text-transform:uppercase}
    .home-module-copy h2{margin:0 0 7px;font-size:24px;line-height:1.2;letter-spacing:-.3px}
    .primary-module .home-module-copy h2{font-size:30px}
    .home-module-copy p{margin:0;padding-right:30px;color:var(--muted);font-size:12px;line-height:1.65}
    .primary-module .home-module-copy p{font-size:13px;max-width:470px}
    .home-module-arrow{position:absolute;right:19px;bottom:18px;display:grid;place-items:center;width:33px;height:33px;border-radius:50%;background:#f3f5f0;color:var(--accent);font-size:19px;font-weight:800;transition:transform .18s ease,background .18s ease}
    .primary-module .home-module-arrow{right:24px;bottom:23px;width:39px;height:39px;font-size:22px;background:rgba(255,255,255,.86)}
    .home-module-card:hover .home-module-arrow{transform:translateX(3px)}
    .home-module-badge{position:absolute;right:18px;top:18px;padding:6px 9px;border-radius:999px;background:#f3f5f0;color:#6a7166;font-size:10px;font-weight:800}
    .primary-module .home-module-badge{right:22px;top:22px;background:rgba(255,255,255,.8)}

    #menu .page-title h1{letter-spacing:-.5px}
    #weekTabs{display:flex;gap:8px;overflow-x:auto;padding-bottom:5px;scrollbar-width:none}
    #weekTabs::-webkit-scrollbar{display:none}
    #weekTabs button{min-width:88px;display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:10px 12px!important;white-space:nowrap}
    #weekTabs button .seven-relative{font-size:13px;font-weight:800;line-height:1.15}
    #weekTabs button .seven-date{font-size:10px;opacity:.68;font-weight:700}
    #weekTabs button.active .seven-date{opacity:.86}
    #mealPlanGrid .seven-plan-date{font-weight:800;color:var(--accent)}
    #mealPlanGrid .seven-empty-date{margin-bottom:8px;color:var(--muted);font-size:11px;font-weight:800}

    @media(max-width:850px){
      .home-module-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
      .home-module-card.primary-module{grid-column:span 1;min-height:230px}
      .home-launcher-intro{align-items:flex-start;flex-direction:column}
    }
    @media(max-width:600px){
      #home.home-launcher-page{padding-top:1px}
      .home-launcher-intro{margin-bottom:18px;gap:12px;padding-top:6px}
      .home-launcher-intro h1{font-size:39px;letter-spacing:-1.15px;max-width:94vw}
      .home-launcher-intro p{font-size:13px;line-height:1.65}
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
      #weekTabs button{min-width:77px;padding:9px 10px!important}
    }
  `;
  document.head.appendChild(style);
}

const modules = [
  {
    href:'#groups', cls:'primary-module groups-module', icon:'👥', eyebrow:'MY GROUPS',
    title:'我的群组', desc:'进入自己的小饭桌，查看成员、群内菜谱、投票和群组采购。', badge:'饭桌中心'
  },
  {
    href:'#menu', cls:'primary-module seven-module', icon:'📅', eyebrow:'NEXT 7 DAYS',
    title:'近七天菜谱', desc:'从今天开始安排未来七天的早餐、午餐和晚餐，打开后默认就是今天。', badge:'未来七天'
  },
  {
    href:'#recipes', cls:'', icon:'📖', eyebrow:'RECIPES',
    title:'菜谱', desc:'浏览做法、口味和食材，也可以上传自己的菜谱。', badge:'做什么'
  },
  {
    href:'#shopping', cls:'', icon:'🧾', eyebrow:'SHOPPING',
    title:'采购', desc:'按采购日整理要买的东西，到了超市直接照着清单买。', badge:'买什么'
  },
  {
    href:'#tomorrow', cls:'tomorrow-module', icon:'🍽️', eyebrow:'TOMORROW',
    title:'明天吃什么', desc:'美食鉴赏家提交想吃的菜，大厨查看群组投票汇总。', badge:'明日投票'
  },
  {
    href:'#pantry', cls:'', icon:'🧊', eyebrow:'PANTRY',
    title:'我的冰箱', desc:'记录现有食材与库存，采购前先看看家里还有什么。', badge:'有什么'
  }
];

function renderHome() {
  const home = document.getElementById('home');
  if (!home) return;
  if (home.dataset.launcherVersion === VERSION) return;
  home.dataset.launcherVersion = VERSION;
  home.classList.add('home-launcher-page');
  home.innerHTML = `
    <div class="home-launcher-intro">
      <div>
        <span class="eyebrow">SHIGUANG · 食光</span>
        <h1 id="homeWelcomeTitle">欢迎回来</h1>
        <p id="homeWelcomeSubtitle">今天也把想吃的、要做的和要买的安排得明明白白。</p>
      </div>
      <div class="home-launcher-status"><i></i><span id="homeRoleStatus">正在读取身份…</span></div>
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
    <div class="home-runtime-compat" aria-hidden="true">
      <div id="todayMeals"></div>
      <span id="pantryCount">0</span><span id="favoriteCount">0</span><span id="shoppingCount">0</span>
      <span id="syncText"></span><span id="syncDot"></span>
    </div>`;
}

async function updateGreeting() {
  const title = document.getElementById('homeWelcomeTitle');
  const subtitle = document.getElementById('homeWelcomeSubtitle');
  const status = document.getElementById('homeRoleStatus');
  if (!title || !subtitle || !status) return;

  if (!supabase) {
    title.textContent = '欢迎来到食光';
    subtitle.textContent = '选择一个模块，就开始今天的饭桌安排。';
    status.textContent = '本机模式';
    return;
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      title.textContent = '欢迎来到食光';
      subtitle.textContent = '登录后会自动识别你的身份，并同步群组、菜谱和采购。';
      status.textContent = '登录后自动同步';
      return;
    }
    const { data } = await supabase
      .from('user_accounts')
      .select('username,food_role')
      .eq('user_id', user.id)
      .maybeSingle();
    const role = data?.food_role;
    const roleName = role === 'chef' ? '大厨' : role === 'foodie' ? '美食鉴赏家' : '食光朋友';
    title.textContent = `欢迎回来，${roleName}`;
    subtitle.textContent = data?.username
      ? `@${data.username}，今天想先从哪一项开始？`
      : '今天想先从哪一项开始？';
    status.textContent = role === 'chef' ? '👨‍🍳 大厨模式' : role === 'foodie' ? '🍽️ 美食鉴赏家' : '云端已登录';
  } catch {
    title.textContent = '欢迎回来';
    subtitle.textContent = '今天想先从哪一项开始？';
    status.textContent = '云端已连接';
  }
}

function relabelMenuPage() {
  const navLink = document.querySelector('.nav a[href="#menu"]');
  if (navLink) navLink.textContent = '近七天菜谱';

  const page = document.getElementById('menu');
  if (!page) return;
  const eyebrow = page.querySelector('.page-title .eyebrow');
  const heading = page.querySelector('.page-title h1');
  const paragraph = page.querySelector('.page-title p');
  if (eyebrow) eyebrow.textContent = 'NEXT 7 DAYS';
  if (heading) heading.textContent = '近七天菜谱';
  const dates = rollingDays();
  const start = dates[0];
  const end = dates[6];
  if (paragraph) paragraph.textContent = `从今天起安排未来 7 天的早餐、午餐和晚餐（${start.month}月${start.day}日—${end.month}月${end.day}日），采购清单会继续按菜单汇总并扣除库存。`;
}

function decorateMealPlan() {
  const grid = document.getElementById('mealPlanGrid');
  const tabs = document.getElementById('weekTabs');
  if (!grid || !tabs) return;
  const active = tabs.querySelector('button.active');
  if (!active) return;
  const meta = rollingDays().find(item => item.key === active.dataset.day);
  if (!meta) return;

  grid.querySelectorAll('.plan-card').forEach(card => {
    const slotName = card.querySelector('.choose')?.dataset.slot || '';
    const slot = card.querySelector('.slot');
    if (slot && slotName) {
      slot.innerHTML = `<span class="seven-plan-date">${meta.relative} · ${meta.month}月${meta.day}日</span> · ${slotName}`;
    }
  });

  grid.querySelectorAll('.empty-plan').forEach(card => {
    const slotName = card.querySelector('.choose')?.dataset.slot || '';
    const inner = card.firstElementChild;
    if (!inner || !slotName) return;
    let label = inner.querySelector('.seven-empty-date');
    if (!label) {
      label = document.createElement('div');
      label.className = 'seven-empty-date';
      inner.prepend(label);
    }
    label.textContent = `${meta.relative} · ${meta.month}月${meta.day}日`;
  });
}

function decorateWeekTabs() {
  if (tabsBusy) return;
  const tabs = document.getElementById('weekTabs');
  if (!tabs) return;
  const buttons = [...tabs.querySelectorAll('button[data-day]')];
  if (buttons.length < 7) return;

  tabsBusy = true;
  try {
    const dates = rollingDays();
    const byDay = new Map(buttons.map(button => [button.dataset.day, button]));
    const desired = dates.map(meta => byDay.get(meta.key)).filter(Boolean);
    const currentOrder = buttons.map(button => button.dataset.day).join('|');
    const desiredOrder = desired.map(button => button.dataset.day).join('|');
    if (currentOrder !== desiredOrder) tabs.replaceChildren(...desired);

    dates.forEach(meta => {
      const button = byDay.get(meta.key);
      if (!button) return;
      const signature = `${meta.relative}-${meta.month}-${meta.day}`;
      if (button.dataset.sevenSignature !== signature) {
        button.dataset.sevenSignature = signature;
        button.innerHTML = `<span class="seven-relative">${meta.relative}</span><span class="seven-date">${meta.month}/${meta.day} · ${meta.key}</span>`;
        button.setAttribute('aria-label', `${meta.relative} ${meta.month}月${meta.day}日 ${meta.key}`);
      }
    });

    if (!choosingInitialDay) {
      choosingInitialDay = true;
      const todayButton = byDay.get(dates[0].key);
      if (todayButton && !todayButton.classList.contains('active')) {
        setTimeout(() => todayButton.click(), 0);
      }
    }
  } finally {
    tabsBusy = false;
  }
  setTimeout(decorateMealPlan, 0);
}

function installRollingObservers() {
  const tabs = document.getElementById('weekTabs');
  const grid = document.getElementById('mealPlanGrid');
  if (tabs && !tabs.dataset.sevenObserved) {
    tabs.dataset.sevenObserved = '1';
    new MutationObserver(() => setTimeout(decorateWeekTabs, 0)).observe(tabs, { childList:true });
  }
  if (grid && !grid.dataset.sevenObserved) {
    grid.dataset.sevenObserved = '1';
    new MutationObserver(() => setTimeout(decorateMealPlan, 0)).observe(grid, { childList:true });
  }
  decorateWeekTabs();
  decorateMealPlan();
}

function refreshAll() {
  setVersion();
  relabelMenuPage();
  installRollingObservers();
  updateGreeting();
}

function init() {
  injectStyles();
  setVersion();
  const run = () => {
    renderHome();
    refreshAll();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(run, 720), { once:true });
  } else {
    setTimeout(run, 720);
  }
  setTimeout(run, 1500);
  window.addEventListener('hashchange', () => setTimeout(refreshAll, 30));
  window.addEventListener('focus', refreshAll);
  window.addEventListener('fansfood-account-changed', () => setTimeout(updateGreeting, 80));
  if (supabase) supabase.auth.onAuthStateChange(() => setTimeout(updateGreeting, 120));
}

init();
