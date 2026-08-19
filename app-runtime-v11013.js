import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const VERSION = '1.1.013';
const cfg = window.SHIGUANG_CONFIG || {};
const supabase = window.Shiguang?.supabase || (cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY
  ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, { auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage} })
  : null);

window.Shiguang = Object.assign(window.Shiguang || {}, { VERSION, supabase });

const $ = (s,r=document)=>r.querySelector(s);
let profile = null;
let user = null;
let domTimer = null;
let observer = null;

function setText(el,text){
  if(!el)return;
  if(el.childNodes.length===1&&el.firstChild?.nodeType===Node.TEXT_NODE){if(el.firstChild.nodeValue!==text)el.firstChild.nodeValue=text;return;}
  if(el.textContent!==text)el.replaceChildren(document.createTextNode(text));
}
function roleLabel(role){return role==='chef'?'大厨':role==='foodie'?'美食鉴赏家':'食光朋友';}
function shownName(){return profile?.display_name?.trim() || profile?.username || '食光朋友';}
function initials(value='食光'){
  const text=String(value).trim().replace(/^@/,'');
  return (text.slice(0,2)||'食光').toUpperCase();
}
function applyVersion(){
  const legacy=$('.brand small');
  if(legacy){
    const fixed=document.createElement('span');
    fixed.className='app-version-static';
    fixed.textContent=`v${VERSION}`;
    legacy.replaceWith(fixed);
  }
  setText($('.app-version-static'),`v${VERSION}`);
  const side=$('[id^="wdSideVersion"]');
  if(side){side.id='wdSideVersionV11013';setText(side,`v${VERSION}`);}
}
function applyPlannerLabels(){
  setText($('#nav a[href="#menu"] span'),'我的七天');
  const page=$('#menu');if(!page)return;
  setText($('.page-title h1',page),'我的七天计划');
  setText($('.page-title .eyebrow',page),'MY 7-DAY PLAN');
  setText($('.page-title p',page),'计划未来七天吃什么。可以按天安排，也可以按早餐、午餐、晚餐集中查看。');
}
function applyProfile(){
  if(!user)return;
  const name=shownName();
  const role=roleLabel(profile?.food_role);
  const sideName=$('#wdSideName'),sideRole=$('#wdSideRole'),sideAvatar=$('#wdSideAvatar');
  setText(sideName,name);
  setText(sideRole,profile?.username?`${role} · @${profile.username}`:role);
  setText(sideAvatar,initials(name));
  const account=$('#accountBtn');
  if(account){const avatar=$('.wd-avatar',account);if(avatar)setText(avatar,initials(name));else account.innerHTML=`<span class="wd-avatar" style="width:100%;height:100%">${initials(name)}</span>`;}
  const greeting=$('.wd-home-greeting');
  if(greeting){setText($('h1',greeting),`嗨，欢迎回来，${name}`);setText($('p',greeting),`${role} · 今天想先从哪一项开始？`);}
}
function applyLoggedOut(){setText($('#wdSideName'),'未登录');setText($('#wdSideRole'),'点击头像登录');}
function animateActivePage(){
  const page=$('.page.active');if(!page)return;
  page.classList.remove('sg-page-enter');
  void page.offsetWidth;
  page.classList.add('sg-page-enter');
  setTimeout(()=>page.classList.remove('sg-page-enter'),280);
}
function applyDOM(){applyVersion();applyPlannerLabels();if(user)applyProfile();else applyLoggedOut();}
function scheduleDOM(delay=40){clearTimeout(domTimer);domTimer=setTimeout(applyDOM,delay);}
async function refreshProfile(){
  if(!supabase){user=null;profile=null;applyDOM();return;}
  const {data}=await supabase.auth.getSession();user=data.session?.user||null;
  if(!user){profile=null;window.Shiguang.profile=null;window.Shiguang.user=null;applyDOM();return;}
  const {data:p}=await supabase.from('user_accounts').select('username,display_name,food_role').eq('user_id',user.id).maybeSingle();
  profile=p||null;window.Shiguang.profile=profile;window.Shiguang.user=user;applyDOM();
  window.dispatchEvent(new CustomEvent('shiguang-profile-ready',{detail:{user,profile}}));
}
function tapFeedback(event){
  const target=event.target.closest('button,.btn,a.card,.wd-core-card,.wd-quick-action,.recipe-card,.group-switch-card');
  if(!target)return;
  target.classList.remove('sg-tap');void target.offsetWidth;target.classList.add('sg-tap');
  setTimeout(()=>target.classList.remove('sg-tap'),180);
}
function init(){
  document.documentElement.classList.add('sg-motion-ready');
  applyDOM();refreshProfile();
  document.addEventListener('pointerdown',tapFeedback,{passive:true});
  window.addEventListener('hashchange',()=>{scheduleDOM(40);setTimeout(animateActivePage,20);});
  window.addEventListener('focus',()=>{scheduleDOM(30);refreshProfile();});
  window.addEventListener('fansfood-account-changed',()=>setTimeout(refreshProfile,80));
  if(supabase)supabase.auth.onAuthStateChange(()=>setTimeout(refreshProfile,120));
  observer=new MutationObserver(()=>scheduleDOM(60));
  observer.observe(document.body,{childList:true,subtree:true});
  setTimeout(applyDOM,500);setTimeout(applyDOM,1500);
  window.dispatchEvent(new CustomEvent('shiguang-runtime-ready'));
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
