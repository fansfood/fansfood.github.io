// 食光云端配置
// 仅保留浏览器可公开使用的 Supabase Project URL 与 Publishable key。
// 不要把 service_role / secret key 放到网页里。
window.SHIGUANG_CONFIG = {
  SUPABASE_URL: "https://wcjcbbnvaejwynnrhfld.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ZY8d8JS8AqF47XzZP-GLSA_hsjNzhU3"
};

// v1.0.017：同一设备/浏览器自动恢复登录，不依赖 IP。
const homeLauncherModule = document.createElement('script');
homeLauncherModule.type = 'module';
homeLauncherModule.src = './home-dashboard-v10012.js';
document.head.appendChild(homeLauncherModule);

const foodBuddyModule = document.createElement('script');
foodBuddyModule.type = 'module';
foodBuddyModule.src = './food-buddy-v10013.js';
document.head.appendChild(foodBuddyModule);

const foodBuddyImagesModule = document.createElement('script');
foodBuddyImagesModule.type = 'module';
foodBuddyImagesModule.src = './food-buddy-images-v10015.js';
document.head.appendChild(foodBuddyImagesModule);

const shoppingBulkModule = document.createElement('script');
shoppingBulkModule.type = 'module';
shoppingBulkModule.src = './shopping-bulk-v10016.js';
document.head.appendChild(shoppingBulkModule);

const authPersistenceModule = document.createElement('script');
authPersistenceModule.type = 'module';
authPersistenceModule.src = './auth-persistence-v10017.js';
document.head.appendChild(authPersistenceModule);

const appVersionModule = document.createElement('script');
appVersionModule.type = 'module';
appVersionModule.src = './version-v10017.js';
document.head.appendChild(appVersionModule);
