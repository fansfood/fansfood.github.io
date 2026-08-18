// 食光 / Eating Time 云端配置
// 浏览器端仅保留公开可用的 Supabase Project URL 与 Publishable key。
// 禁止在前端写入 service_role / secret key。
window.SHIGUANG_CONFIG = {
  SUPABASE_URL: "https://wcjcbbnvaejwynnrhfld.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ZY8d8JS8AqF47XzZP-GLSA_hsjNzhU3"
};

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

// 业务增强模块：保持原数据库、权限与 API 逻辑，不因 UI 大改而重写。
loadModule('./food-buddy-v10013.js', 'foodBuddyModule');
loadModule('./food-buddy-images-v10015.js', 'foodBuddyImagesModule');
loadModule('./shopping-dates.js', 'shoppingDatesModule');
loadModule('./shopping-ui-v10009.js', 'shoppingUICompactModule');
loadModule('./shopping-bulk-v10016.js', 'shoppingBulkModule');
loadModule('./auth-persistence-v10017.js', 'authPersistenceModule');

// 最后加载新的 App Shell / Design System，统一接管桌面与移动端视觉。
loadModule('./warm-dining-v11009.js', 'warmDiningV11009Module');
