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

function loadStyle(href, id) {
  if (id && document.getElementById(id)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
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

// v1.1.009 · Warm Dining 视觉系统。
loadStyle('./warm-dining-v11009.css', 'warmDiningV11009CSS');
loadStyle('./shopping-bulk-v11009.css', 'shoppingBulkV11009CSS');
loadStyle('./warm-dining-fixes-v11009.css', 'warmDiningFixesV11009CSS');
loadStyle('./warm-dining-polish-v11009.css', 'warmDiningPolishV11009CSS');

// 业务增强模块：保持原数据库、权限与 API 逻辑，不因 UI 大改而重写。
loadModule('./food-buddy-v10013.js', 'foodBuddyModule');
loadModule('./food-buddy-images-v10015.js', 'foodBuddyImagesModule');
loadModule('./shopping-loader-v11009.js', 'shoppingLoaderV11009Module');
loadModule('./auth-persistence-v10017.js', 'authPersistenceModule');
loadModule('./recipe-favorites-v11009.js', 'recipeFavoritesV11009Module');

// 最后加载新的 App Shell / Design System 和真实数据细节增强。
loadModule('./warm-dining-v11009.js', 'warmDiningV11009Module');
loadModule('./warm-dining-polish-v11009.js', 'warmDiningPolishV11009Module');
