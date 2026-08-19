// 食光 / Eating Time 云端配置
// 浏览器端仅保留公开可用的 Supabase Project URL 与 Publishable key。
// 禁止在前端写入 service_role / secret key。
window.SHIGUANG_CONFIG = {
  SUPABASE_URL: "https://wcjcbbnvaejwynnrhfld.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ZY8d8JS8AqF47XzZP-GLSA_hsjNzhU3"
};
window.SHIGUANG_VERSION = '1.1.013';

// 新设备第一次打开不再注入 Demo 菜单/库存/收藏。
// 已有本机状态和云端状态完全保留，由 app.js 正常读取并同步。
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
  link.rel = 'stylesheet';
  link.href = src;
  if (id) link.id = id;
  document.head.appendChild(link);
}
function loadModule(src, id) {
  if (id && document.getElementById(id)) return;
  const script = document.createElement('script');
  script.type = 'module';
  script.src = src;
  if (id) script.id = id;
  document.head.appendChild(script);
}

// 基础业务增强。
loadModule('./shopping-loader-v11009.js', 'shoppingLoaderV11009Module');
loadModule('./auth-persistence-v10017.js', 'authPersistenceModule');
loadModule('./recipe-favorites-v11009.js', 'recipeFavoritesV11009Module');

// 饭搭子：单一业务模块。
loadStyle('./food-buddy-v11012.css', 'foodBuddyV11012CSS');
loadModule('./food-buddy-v11012.js', 'foodBuddyV11012Module');

// 小饭桌 AA 账本。
loadStyle('./group-ledger-v11010.css', 'groupLedgerV11010CSS');
loadModule('./group-ledger-v11010.js', 'groupLedgerV11010Module');
loadModule('./group-ledger-bridge-v11010.js', 'groupLedgerBridgeV11010Module');

// Warm Dining App Shell / Design System。
loadModule('./warm-dining-v11009.js', 'warmDiningV11009Module');
loadModule('./warm-dining-polish-v11009.js', 'warmDiningPolishV11009Module');

// 小饭桌内部独立七天菜单。
loadStyle('./group-seven-days-v11011.css', 'groupSevenDaysV11011CSS');
loadModule('./group-seven-days-v11011.js', 'groupSevenDaysV11011Module');

// v1.1.013 · 统一昵称/版本/微动效 + 个人七天双视图计划器。
loadStyle('./app-v11013.css', 'appV11013CSS');
loadModule('./app-runtime-v11013.js', 'appRuntimeV11013Module');
loadModule('./personal-planner-v11013.js', 'personalPlannerV11013Module');
