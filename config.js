// 食光云端配置
// 仅保留浏览器可公开使用的 Supabase Project URL 与 Publishable key。
// 不要把 service_role / secret key 放到网页里。
window.SHIGUANG_CONFIG = {
  SUPABASE_URL: "https://wcjcbbnvaejwynnrhfld.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ZY8d8JS8AqF47XzZP-GLSA_hsjNzhU3"
};

// v1.0.012：身份欢迎区、主页入口重排与“近七天菜谱”。
const homeLauncherModule = document.createElement('script');
homeLauncherModule.type = 'module';
homeLauncherModule.src = './home-dashboard-v10012.js';
document.head.appendChild(homeLauncherModule);
