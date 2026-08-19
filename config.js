// 食光 / Eating Time 云端配置
// 浏览器端仅保留公开可用的 Supabase Project URL 与 Publishable key。
window.SHIGUANG_CONFIG = {
  SUPABASE_URL: "https://wcjcbbnvaejwynnrhfld.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ZY8d8JS8AqF47XzZP-GLSA_hsjNzhU3"
};
window.SHIGUANG_VERSION = '1.1.014';

// 在 app.js 注册路由之前同步准备“饭搭子”页面，避免动态模块加载顺序导致 #buddies 无法打开。
(function ensureStableRoutes(){
  const main = document.querySelector('main');
  const nav = document.getElementById('nav');
  if (main && !document.getElementById('buddies')) {
    const page = document.createElement('section');
    page.className = 'page';
    page.id = 'buddies';
    page.innerHTML = '<div class="page-title"><div><span class="eyebrow">FOOD BUDDIES</span><h1>饭搭子</h1><p>最多 5 位好朋友。记录每天吃了什么、吃了多少，也顺手记录有没有运动。</p></div></div><div id="buddyContent"></div>';
    const tomorrow = document.getElementById('tomorrow');
    if (tomorrow) tomorrow.insertAdjacentElement('beforebegin', page); else main.appendChild(page);
  }
  if (nav && !nav.querySelector('a[href="#buddies"]')) {
    const a = document.createElement('a');
    a.href = '#buddies';
    a.textContent = '饭搭子';
    nav.querySelector('a[href="#groups"]')?.insertAdjacentElement('afterend', a);
  }
  const badge = document.querySelector('.brand small');
  if (badge) badge.textContent = 'v1.1.014';
})();

// 新设备不注入 Demo 菜单/库存/收藏；已有本机与云端状态原样保留。
if (!localStorage.getItem('shiguang-v2-state')) {
  const emptyPlan = {};
  ['周一','周二','周三','周四','周五','周六','周日'].forEach(day => {
    emptyPlan[day] = { 早餐:null, 午餐:null, 晚餐:null };
  });
  localStorage.setItem('shiguang-v2-state', JSON.stringify({
    plan: emptyPlan,
    pantry: [],
    checked: {},
    manualShopping: [],
    favorites: []
  }));
}

function loadStyle(src, id) {
  if (id && document.getElementById(id)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = src;
  if (id) link.id = id;
  document.head.appendChild(link);
}
function loadModule(src, id) {
  if (id && document.getElementById(id)) return;
  const script = document.createElement('script');
  script.type = 'module'; script.src = src;
  if (id) script.id = id;
  document.head.appendChild(script);
}

// 稳定 Runtime：只管理共享会话、昵称、版本与轻动效；不再监听/重写整个 DOM。
loadStyle('./app-v11013.css', 'appV11013CSS');
loadModule('./app-runtime-v11014.js', 'appRuntimeV11014Module');

// Warm Dining 单一 UI 壳：替代旧 warm-dining + polish 两套同时改 DOM 的结构。
loadModule('./warm-dining-shell-v11014.js', 'warmDiningShellV11014Module');

// 基础业务增强。
loadModule('./shopping-loader-v11009.js', 'shoppingLoaderV11009Module');
loadModule('./auth-persistence-v10017.js', 'authPersistenceModule');
loadModule('./recipe-favorites-v11009.js', 'recipeFavoritesV11009Module');
loadModule('./recipe-actions-v11014.js', 'recipeActionsV11014Module');

// 饭搭子：多人多食物、照片、健身、留言、互动。
loadStyle('./food-buddy-v11012.css', 'foodBuddyV11012CSS');
loadModule('./food-buddy-v11012.js', 'foodBuddyV11012Module');

// 小饭桌 AA 账本。
loadStyle('./group-ledger-v11010.css', 'groupLedgerV11010CSS');
loadModule('./group-ledger-v11010.js', 'groupLedgerV11010Module');
loadModule('./group-ledger-bridge-v11010.js', 'groupLedgerBridgeV11010Module');

// 小饭桌内部独立七天菜单。
loadStyle('./group-seven-days-v11011.css', 'groupSevenDaysV11011CSS');
loadModule('./group-seven-days-v11011.js', 'groupSevenDaysV11011Module');

// 个人“我的七天”：按天 / 按餐双视图。
loadModule('./personal-planner-v11013.js', 'personalPlannerV11013Module');
