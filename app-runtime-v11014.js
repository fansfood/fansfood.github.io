import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const VERSION = window.SHIGUANG_VERSION || '1.1.014';
const cfg = window.SHIGUANG_CONFIG || {};
const supabase = window.Shiguang?.supabase || (cfg.SUPABASE_URL && cfg.SUPABASE_PUBLISHABLE_KEY
  ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY, {
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage}
    })
  : null);

const $ = (s,r=document) => r.querySelector(s);
let user = null;
let profile = null;
let refreshPromise = null;

function roleLabel(role){return role==='chef'?'大厨':role==='foodie'?'美食鉴赏家':'食光朋友';}
function shownName(){return profile?.display_name?.trim() || profile?.username || '食光朋友';}
function initials(value='食光'){
  const text=String(value).trim().replace(/^@/,'');
  return (text.slice(0,2)||'食光').toUpperCase();
}
function setText(el,text){if(el&&el.textContent!==text)el.textContent=text;}
function applyVersion(){
  const badge=$('.brand small,.app-version-static');
  if(badge){badge.classList.add('app-version-static');setText(badge,`v${VERSION}`);}
  const side=$('[id^="wdSideVersion"]');if(side)setText(side,`v${VERSION}`);
}
function applyProfileChrome(){
  applyVersion();
  if(!user)return;
  const name=shownName(), role=roleLabel(profile?.food_role);
  setText($('#wdSideName'),name);
  setText($('#wdSideRole'),profile?.username?`${role} · @${profile.username}`:role);
  setText($('#wdSideAvatar'),initials(name));
  const account=$('#accountBtn');
  if(account){
    const avatar=$('.wd-avatar',account);
    if(avatar)setText(avatar,initials(name));
  }
  const greeting=$('.wd-home-greeting');
  if(greeting){setText($('h1',greeting),`嗨，欢迎回来，${name}`);setText($('p',greeting),`${role} · 今天想先从哪一项开始？`);}
}
async function refreshProfile(){
  if(refreshPromise)return refreshPromise;
  refreshPromise=(async()=>{
    if(!supabase){user=null;profile=null;return {user,profile};}
    const {data}=await supabase.auth.getSession();user=data.session?.user||null;
    if(!user){profile=null;applyVersion();return {user,profile};}
    const {data:p}=await supabase.from('user_accounts').select('username,display_name,food_role').eq('user_id',user.id).maybeSingle();
    profile=p||null;
    applyProfileChrome();
    window.Shiguang.user=user;window.Shiguang.profile=profile;
    window.dispatchEvent(new CustomEvent('shiguang-profile-ready',{detail:{user,profile}}));
    return {user,profile};
  })().finally(()=>{refreshPromise=null;});
  return refreshPromise;
}
function animateActivePage(){
  const page=$('.page.active');if(!page)return;
  page.classList.remove('sg-page-enter');void page.offsetWidth;page.classList.add('sg-page-enter');
  setTimeout(()=>page.classList.remove('sg-page-enter'),260);
}
function tapFeedback(event){
  const target=event.target.closest('button,.btn,a.card,.wd-core-card,.wd-quick-action,.recipe-card,.group-switch-card,.sg-plan-row');
  if(!target)return;
  target.classList.remove('sg-tap');void target.offsetWidth;target.classList.add('sg-tap');
  setTimeout(()=>target.classList.remove('sg-tap'),170);
}

window.Shiguang = Object.assign(window.Shiguang || {}, {
  VERSION, supabase,
  get user(){return user;},
  get profile(){return profile;},
  refreshProfile,
  displayName:shownName,
  roleLabel
});

function init(){
  document.documentElement.classList.add('sg-motion-ready');
  applyVersion();refreshProfile();
  document.addEventListener('pointerdown',tapFeedback,{passive:true});
  window.addEventListener('hashchange',()=>{applyVersion();setTimeout(animateActivePage,20);});
  window.addEventListener('focus',refreshProfile);
  window.addEventListener('fansfood-account-changed',()=>setTimeout(refreshProfile,80));
  window.addEventListener('shiguang-shell-ready',()=>{applyVersion();applyProfileChrome();});
  if(supabase)supabase.auth.onAuthStateChange(()=>setTimeout(refreshProfile,120));
  setTimeout(()=>{applyVersion();applyProfileChrome();},700);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
