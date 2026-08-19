// 食光 / Eating Time 云端配置
// 浏览器端仅保留公开可用的 Supabase Project URL 与 Publishable key。
// 禁止在前端写入 service_role / secret key。
window.SHIGUANG_CONFIG = {
  SUPABASE_URL: "https://wcjcbbnvaejwynnrhfld.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ZY8d8JS8AqF47XzZP-GLSA_hsjNzhU3"
};

// v1.1.009 起：新设备第一次打开时不再注入 Demo 菜单/库存/收藏。
// 已经存在的本机状态和云端状态完全保留，由 app.js 正常读取并同步。
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

// 业务增强模块：保持原数据库、权限与 API 逻辑，不因 UI 大改而重写。
loadModule('./shopping-loader-v11009.js', 'shoppingLoaderV11009Module');
loadModule('./auth-persistence-v10017.js', 'authPersistenceModule');
loadModule('./recipe-favorites-v11009.js', 'recipeFavoritesV11009Module');

// v1.1.012 · 饭搭子合并为单一模块：多人多食物、照片、健身、留言、互动。
loadStyle('./food-buddy-v11012.css', 'foodBuddyV11012CSS');
loadModule('./food-buddy-v11012.js', 'foodBuddyV11012Module');

// v1.1.010 · 小饭桌 AA 账本。
loadStyle('./group-ledger-v11010.css', 'groupLedgerV11010CSS');
loadModule('./group-ledger-v11010.js', 'groupLedgerV11010Module');
loadModule('./group-ledger-bridge-v11010.js', 'groupLedgerBridgeV11010Module');

// Warm Dining App Shell / Design System。
loadModule('./warm-dining-v11009.js', 'warmDiningV11009Module');
loadModule('./warm-dining-polish-v11009.js', 'warmDiningPolishV11009Module');

// v1.1.011 · 外部“我的七天” + 小饭桌内部独立七天菜单。
loadStyle('./group-seven-days-v11011.css', 'groupSevenDaysV11011CSS');
loadModule('./group-seven-days-v11011.js', 'groupSevenDaysV11011Module');

// 最后守护本次对外版本号。
loadModule('./version-v11012.js', 'versionV11012Module');
