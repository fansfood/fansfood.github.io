// 食光 / Eating Time · v1.1.000
window.SHIGUANG_CONFIG = {
  SUPABASE_URL: "https://wcjcbbnvaejwynnrhfld.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ZY8d8JS8AqF47XzZP-GLSA_hsjNzhU3"
};
window.SHIGUANG_VERSION = '1.1.000';

// 最小路由保险：只负责 page.active，不重绘业务页面。
(function ensureStableRoutes(){
  const ROUTES = new Set(['home','today','groups','buddies','tomorrow','menu','recipes','shopping','ingredients','pantry','stats','settings']);
  const main = document.querySelector('main');
  const nav = document.getElementById('nav');
  if (main && !document.getElementById('buddies')) {
    const page = document.createElement('section');
    page.className = 'page'; page.id = 'buddies';
    page.innerHTML = '<div class="page-title"><div><span class="eyebrow">FOOD BUDDIES</span><h1>饭搭子</h1><p>最多 5 位好朋友。记录每天吃了什么、吃了多少，也顺手记录有没有运动。</p></div></div><div id="buddyContent"></div>';
    const tomorrow = document.getElementById('tomorrow');
    tomorrow ? tomorrow.insertAdjacentElement('beforebegin', page) : main.appendChild(page);
  }
  if (nav && !nav.querySelector('a[href="#buddies"]')) {
    const a=document.createElement('a'); a.href='#buddies'; a.textContent='饭搭子';
    nav.querySelector('a[href="#groups"]')?.insertAdjacentElement('afterend',a);
  }
  const showRoute=()=>{
    const raw=(location.hash||'#home').slice(1), id=ROUTES.has(raw)?raw:'home';
    const page=document.getElementById(id)||document.getElementById('home'); if(!page)return;
    document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p===page));
    document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')===`#${id}`));
    document.getElementById('nav')?.classList.remove('open');
  };
  document.addEventListener('click',e=>{
    const link=e.target.closest?.('#nav a[href^="#"]'); if(!link)return;
    const hash=link.getAttribute('href'); if(!hash||!ROUTES.has(hash.slice(1)))return;
    e.preventDefault(); location.hash===hash?showRoute():location.hash=hash;
  },true);
  window.addEventListener('hashchange',showRoute);
  window.addEventListener('DOMContentLoaded',showRoute,{once:true});
  window.SHIGUANG_SHOW_ROUTE=showRoute;
  const badge=document.querySelector('.brand small'); if(badge)badge.textContent='v1.1.000';
})();

// 新设备保持真实 Empty State，不注入演示菜单/库存/收藏。
if (!localStorage.getItem('shiguang-v2-state')) {
  const plan={}; ['周一','周二','周三','周四','周五','周六','周日'].forEach(d=>plan[d]={早餐:null,午餐:null,晚餐:null});
  localStorage.setItem('shiguang-v2-state',JSON.stringify({plan,pantry:[],checked:{},manualShopping:[],favorites:[]}));
}

function loadStyle(src,id){if(id&&document.getElementById(id))return;const link=document.createElement('link');link.rel='stylesheet';link.href=src;if(id)link.id=id;document.head.appendChild(link)}
function loadModule(src,id){if(id&&document.getElementById(id))return;const script=document.createElement('script');script.type='module';script.src=src;if(id)script.id=id;document.head.appendChild(script)}

// 共享账号 / Supabase Runtime。保持单一会话源。
loadStyle('./app-v11013.css','appV11013CSS');
loadModule('./app-runtime-v11014.js','appRuntimeV11014Module');

// 已有业务增强：只保留业务，不再让旧 Warm Dining JS 接管布局。
loadModule('./shopping-loader-v11009.js','shoppingLoaderV11009Module');
loadModule('./purchase-to-pantry-v11000.js','purchaseToPantryV11000Module');
loadModule('./auth-persistence-v10017.js','authPersistenceModule');
loadModule('./recipe-favorites-v11009.js','recipeFavoritesV11009Module');
loadModule('./recipe-actions-v11014.js','recipeActionsV11014Module');
loadStyle('./food-buddy-v11012.css','foodBuddyV11012CSS');
loadModule('./food-buddy-v11016.js','foodBuddyV11016Module');
loadStyle('./group-ledger-v11010.css','groupLedgerV11010CSS');
loadModule('./group-ledger-v11010.js','groupLedgerV11010Module');
loadModule('./group-ledger-bridge-v11010.js','groupLedgerBridgeV11010Module');
loadStyle('./group-seven-days-v11011.css','groupSevenDaysV11011CSS');
loadModule('./group-seven-days-v11011.js','groupSevenDaysV11011Module');
loadModule('./personal-planner-v11013.js','personalPlannerV11013Module');

// v1.1.000 唯一主 View Layer：Today-centric Warm Dining。
loadStyle('./ui-v11000.css','uiV11000CSS');
loadModule('./ui-v11000.js','uiV11000Module');
